import axios, { AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios';

/**
 * 后端统一响应结构。
 * 按实际协议调整 `ApiResponse` 与 `SUCCESS_CODES` 即可，业务层用法不变。
 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

/**
 * 统一的请求错误：保留业务码 / HTTP 状态码，
 * 业务层可通过 `error.code` 做分支处理。
 */
export class ApiError extends Error {
  /** 业务错误码或 HTTP 状态码；网络异常等无码场景为 -1 */
  readonly code: number;

  constructor(message: string, code = -1) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

export interface RequestConfig extends AxiosRequestConfig {
  /** 跳过 401 的全局处理（例如登录接口本身） */
  silent?: boolean;
}

const SUCCESS_CODES = new Set([0, 200]);

const HTTP_ERROR_MAP: Record<number, string> = {
  400: '请求参数错误',
  401: '登录状态已失效',
  403: '无权限访问',
  404: '请求资源不存在',
  409: '请求冲突',
  422: '参数校验失败',
  429: '请求过于频繁',
  500: '服务器内部错误',
  502: '网关错误',
  503: '服务不可用',
  504: '网关超时',
};

let unauthorizedHandler: (() => void) | undefined;

/**
 * 注册 401 处理回调。
 * 基础模板不内置登录页，业务项目可在 main.ts 中注册跳转逻辑。
 */
export function setUnauthorizedHandler(handler?: () => void): void {
  unauthorizedHandler = handler;
}

function handleUnauthorized(config?: RequestConfig): void {
  if (config?.silent) {
    return;
  }

  unauthorizedHandler?.();
}

/** 统一响应体的宽松形态：错误响应可能没有 data 字段 */
type BusinessPayload = {
  code: number;
  message?: string;
  data?: unknown;
};

/**
 * 判断是否为统一响应体。
 *
 * 只要求数字 code + message/data 之一：
 * 错误响应经常没有 data 字段（如 { code: 500, message: 'xxx' }），
 * 若强制要求 data 存在，这类业务错误会被当成普通数据返回。
 */
function isBusinessPayload(data: unknown): data is BusinessPayload {
  if (!data || typeof data !== 'object' || !('code' in data)) {
    return false;
  }

  const code: unknown = data.code;

  return typeof code === 'number' && ('message' in data || 'data' in data);
}

function pickMessage(payload: unknown): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const value: unknown = payload.message;
    if (typeof value === 'string') {
      return value;
    }
  }

  return '';
}

/**
 * 下载类接口出错时后端可能返回 JSON 错误体，
 * 这里把二进制响应重新解析成 JSON，便于提取错误信息。
 */
async function unwrapJsonBody(data: unknown, headers: unknown): Promise<unknown> {
  const headerMap = headers as Record<string, unknown> | undefined;
  const contentType = headerMap?.['content-type'];
  if (!/application\/json/i.test(typeof contentType === 'string' ? contentType : '')) {
    return data;
  }

  let text: string | null = null;
  if (data instanceof Blob) {
    text = await data.text();
  } else if (data instanceof ArrayBuffer) {
    text = new TextDecoder().decode(data);
  } else if (typeof data === 'string') {
    text = data;
  }

  if (text === null) {
    return data;
  }

  try {
    return JSON.parse(text);
  } catch {
    return data;
  }
}

export const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 30_000,
});

/**
 * axios 的类型约定要求响应拦截器返回 AxiosResponse，
 * 但这里刻意把统一响应体解包成业务数据，真实返回类型由 http.* 的泛型描述，
 * 因此需要一次性类型断言。
 */
const onResponse = ((response: AxiosResponse): unknown => {
  // 文件流保持完整响应，便于读取 Content-Disposition 等响应头
  if (response.config.responseType === 'blob' || response.config.responseType === 'arraybuffer') {
    return response;
  }

  const payload: unknown = response.data;

  // 非统一响应结构直接透传，兼容第三方接口
  if (!isBusinessPayload(payload)) {
    return payload;
  }

  if (SUCCESS_CODES.has(payload.code)) {
    // 无 data 字段时返回整个响应体，避免调用方拿到 undefined
    return 'data' in payload ? payload.data : payload;
  }

  if (payload.code === 401) {
    handleUnauthorized(response.config as RequestConfig);
  }

  return Promise.reject(new ApiError(payload.message || '请求失败', payload.code));
}) as unknown as (response: AxiosResponse) => AxiosResponse;

request.interceptors.response.use(onResponse, async (error: AxiosError) => {
  // 主动取消的请求不当作错误提示
  if (axios.isCancel(error)) {
    return Promise.reject(error);
  }

  const status = error.response?.status;
  const requestConfig = error.config as RequestConfig | undefined;

  if (status === 401) {
    handleUnauthorized(requestConfig);
  }

  const serverMessage = pickMessage(
    await unwrapJsonBody(error.response?.data, error.response?.headers),
  );

  const message =
    serverMessage ||
    (status
      ? HTTP_ERROR_MAP[status] || `请求失败（${status}）`
      : error.code === 'ECONNABORTED'
        ? '请求超时，请稍后再试'
        : '网络异常，请检查网络连接');

  return Promise.reject(new ApiError(message, status ?? -1));
});

/**
 * 常用请求方法。
 *
 * @example
 * ```ts
 * const list = await http.get<User[]>('/users', { page: 1 });
 * ```
 */
export const http = {
  request<T = unknown>(config: RequestConfig) {
    return request.request<unknown, T>(config);
  },

  get<T = unknown>(url: string, params?: Record<string, unknown>, config?: RequestConfig) {
    return request.get<unknown, T>(url, {
      ...config,
      ...(params !== undefined ? { params } : null),
    });
  },

  post<T = unknown>(url: string, data?: unknown, config?: RequestConfig) {
    return request.post<unknown, T>(url, data, config);
  },

  put<T = unknown>(url: string, data?: unknown, config?: RequestConfig) {
    return request.put<unknown, T>(url, data, config);
  },

  patch<T = unknown>(url: string, data?: unknown, config?: RequestConfig) {
    return request.patch<unknown, T>(url, data, config);
  },

  delete<T = unknown>(url: string, params?: Record<string, unknown>, config?: RequestConfig) {
    return request.delete<unknown, T>(url, {
      ...config,
      ...(params !== undefined ? { params } : null),
    });
  },

  /**
   * 文件下载：返回完整 AxiosResponse（含 headers），
   * 业务层可读取 Content-Disposition 获取文件名。
   */
  download(
    url: string,
    options: {
      method?: 'get' | 'post';
      params?: Record<string, unknown>;
      data?: unknown;
      config?: RequestConfig;
    } = {},
  ) {
    const { method = 'get', params, data, config } = options;

    return request.request<unknown, AxiosResponse<Blob>>({
      ...config,
      url,
      method,
      ...(params !== undefined ? { params } : null),
      ...(data !== undefined ? { data } : null),
      responseType: 'blob',
    });
  },
};
