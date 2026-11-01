import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios, {
  AxiosError,
  CanceledError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { ApiError, http, setUnauthorizedHandler } from '@/utils/request';

/** 用自定义 adapter 控制响应，无需网络与额外 mock 库 */
function okAdapter(data: unknown, overrides: Partial<AxiosResponse> = {}) {
  return (config: InternalAxiosRequestConfig): Promise<AxiosResponse> =>
    Promise.resolve({
      data,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      ...overrides,
    });
}

function failAdapter(error: unknown) {
  return (_config: InternalAxiosRequestConfig): Promise<AxiosResponse> => Promise.reject(error);
}

function httpError(status: number, body: unknown, contentType = 'application/json'): AxiosError {
  const config = { headers: {} } as InternalAxiosRequestConfig;
  return new AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_REQUEST',
    config,
    null,
    {
      data: body,
      status,
      statusText: '',
      headers: { 'content-type': contentType },
      config,
    },
  );
}

async function expectApiError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('expected promise to reject');
}

describe('request', () => {
  let unauthorized = vi.fn();

  beforeEach(() => {
    unauthorized = vi.fn();
    setUnauthorizedHandler(unauthorized);
  });

  afterEach(() => {
    setUnauthorizedHandler(undefined);
  });

  it('unwraps { code, message, data } business payloads', async () => {
    const result = await http.get<{ id: number }>('/users', undefined, {
      adapter: okAdapter({ code: 0, message: 'ok', data: { id: 1 } }),
    });

    expect(result).toEqual({ id: 1 });
  });

  it('treats code 200 as success as well', async () => {
    const result = await http.get<number[]>('/users', undefined, {
      adapter: okAdapter({ code: 200, message: 'ok', data: [1, 2] }),
    });

    expect(result).toEqual([1, 2]);
  });

  it('returns the whole payload when the data field is missing', async () => {
    const result = await http.get<{ code: number; message: string }>('/ping', undefined, {
      adapter: okAdapter({ code: 0, message: 'pong' }),
    });

    expect(result).toEqual({ code: 0, message: 'pong' });
  });

  it('passes non-business payloads through untouched', async () => {
    const thirdParty = { foo: 'bar' };
    const result = await http.get<typeof thirdParty>('/third-party', undefined, {
      adapter: okAdapter(thirdParty),
    });

    expect(result).toBe(thirdParty);
  });

  it('rejects business errors with code and message', async () => {
    const error = await expectApiError(
      http.get('/users', undefined, {
        adapter: okAdapter({ code: 500, message: '服务器开小差了' }),
      }),
    );

    expect(error.code).toBe(500);
    expect(error.message).toBe('服务器开小差了');
  });

  it('falls back to a generic message when the business error message is empty', async () => {
    const error = await expectApiError(
      http.get('/users', undefined, {
        adapter: okAdapter({ code: 500, message: '' }),
      }),
    );

    expect(error.message).toBe('请求失败');
  });

  it('triggers the unauthorized handler on business code 401', async () => {
    await expectApiError(
      http.get('/me', undefined, {
        adapter: okAdapter({ code: 401, message: '登录过期' }),
      }),
    );

    expect(unauthorized).toHaveBeenCalledTimes(1);
  });

  it('skips the unauthorized handler when silent is set', async () => {
    await expectApiError(
      http.get('/me', undefined, {
        silent: true,
        adapter: okAdapter({ code: 401, message: '登录过期' }),
      }),
    );

    expect(unauthorized).not.toHaveBeenCalled();
  });

  it('keeps file responses intact for downloads', async () => {
    const blob = new Blob(['file-content']);
    const response = await http.download('/export', {
      config: {
        adapter: okAdapter(blob, {
          headers: { 'content-disposition': 'attachment; filename=a.csv' },
        }),
      },
    });

    expect(response.data).toBe(blob);
    expect(response.headers['content-disposition']).toContain('a.csv');
  });

  it('maps HTTP errors to ApiError with the server message', async () => {
    const error = await expectApiError(
      http.get('/users', undefined, {
        adapter: failAdapter(httpError(404, { message: '资源不存在' })),
      }),
    );

    expect(error.code).toBe(404);
    expect(error.message).toBe('资源不存在');
  });

  it('uses the HTTP status map when the error body is not JSON', async () => {
    const error = await expectApiError(
      http.get('/users', undefined, {
        adapter: failAdapter(httpError(503, '<html>Service Unavailable</html>', 'text/html')),
      }),
    );

    expect(error.code).toBe(503);
    expect(error.message).toBe('服务不可用');
  });

  it('triggers the unauthorized handler on HTTP 401', async () => {
    await expectApiError(
      http.get('/me', undefined, {
        adapter: failAdapter(httpError(401, {})),
      }),
    );

    expect(unauthorized).toHaveBeenCalledTimes(1);
  });

  it('reports timeouts with a friendly message', async () => {
    const config = { headers: {} } as InternalAxiosRequestConfig;
    const timeout = new AxiosError('timeout of 30000ms exceeded', 'ECONNABORTED', config);

    const error = await expectApiError(
      http.get('/slow', undefined, {
        adapter: failAdapter(timeout),
      }),
    );

    expect(error.code).toBe(-1);
    expect(error.message).toBe('请求超时，请稍后再试');
  });

  it('rethrows cancellations untouched', async () => {
    const cancel = new CanceledError('canceled by user');
    let caught: unknown;

    try {
      await http.get('/users', undefined, {
        adapter: failAdapter(cancel),
      });
    } catch (error) {
      caught = error;
    }

    expect(axios.isCancel(caught)).toBe(true);
  });

  it('passes query params and request data through', async () => {
    const seen: InternalAxiosRequestConfig[] = [];
    const capture = okAdapter({ code: 0, message: 'ok', data: null });
    const adapter = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      seen.push(config);
      return capture(config);
    };

    await http.get('/users', { page: 2 }, { adapter });
    await http.post('/users', { name: 'a' }, { adapter });

    expect(seen[0]?.params).toEqual({ page: 2 });
    expect(seen[1]?.data).toBe('{"name":"a"}');
    expect(seen[1]?.method).toBe('post');
  });
});
