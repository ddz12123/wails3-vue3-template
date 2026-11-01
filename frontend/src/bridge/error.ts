/** 桥接错误分类：便于业务层按类型分支处理 */
export type BridgeErrorCode =
  /** 当前不在 Wails 运行环境（例如直接用浏览器打开 vite dev） */
  | 'not-ready'
  /** Go 服务返回了未结构化的错误 */
  | 'runtime'
  /** Go 侧返回了 AppError 结构化业务错误 */
  | 'business'
  /** 前端参数/协议校验失败 */
  | 'validation'
  /** 其他未知错误 */
  | 'unknown';

export interface BridgeErrorOptions {
  cause?: unknown;
  /** Go 侧 AppError.Code，仅 business 错误存在 */
  businessCode?: string;
}

/**
 * 统一的桥接错误。
 *
 * Go 绑定调用失败时抛出的 `RuntimeError` 会被归一化成该类型，
 * 业务层只需 catch `BridgeError` 即可，无需关心底层传输细节。
 */
export class BridgeError extends Error {
  readonly code: BridgeErrorCode;
  readonly businessCode?: string;

  constructor(
    message: string,
    code: BridgeErrorCode = 'unknown',
    options: BridgeErrorOptions = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'BridgeError';
    this.code = code;
    this.businessCode = options.businessCode;
  }
}

interface BusinessErrorPayload {
  code: string;
  message: string;
}

function readBusinessError(cause: unknown): BusinessErrorPayload | null {
  if (!cause || typeof cause !== 'object') {
    return null;
  }

  const payload = cause as { code?: unknown; message?: unknown };
  if (typeof payload.code !== 'string' || typeof payload.message !== 'string') {
    return null;
  }

  return { code: payload.code, message: payload.message };
}

/** 把任意异常归一化为 BridgeError */
export function normalizeBridgeError(cause: unknown, fallback = '调用本地服务失败'): BridgeError {
  if (cause instanceof BridgeError) {
    return cause;
  }

  if (cause instanceof Error) {
    const businessError = readBusinessError((cause as Error & { cause?: unknown }).cause);
    if (businessError) {
      return new BridgeError(businessError.message, 'business', {
        cause,
        businessCode: businessError.code,
      });
    }

    return new BridgeError(cause.message || fallback, 'runtime', { cause });
  }

  if (typeof cause === 'string' && cause.trim()) {
    return new BridgeError(cause, 'runtime');
  }

  return new BridgeError(fallback, 'unknown', { cause });
}
