import { normalizeBridgeError } from './error';
import { assertWailsRuntime } from './runtime';

export interface BridgeCallOptions {
  /** 错误信息兜底文案 */
  fallback?: string;
  /**
   * 是否要求处于 Wails 运行环境，默认 true。
   * 纯前端工具类调用（如复制文本的 Web API 降级）可设为 false。
   */
  requireRuntime?: boolean;
}

/**
 * 把一个 Go 绑定 / Wails 运行时方法包装成「统一错误处理」的函数。
 *
 * @example
 * ```ts
 * import { UserService } from '@bindings/changeme';
 *
 * export const listUsers = createBridgeCall(UserService.List, {
 *   fallback: '获取用户列表失败',
 * });
 *
 * await listUsers(); // 抛出的一定是 BridgeError
 * ```
 */
export function createBridgeCall<Args extends unknown[], Result>(
  fn: (...args: Args) => PromiseLike<Result>,
  options: BridgeCallOptions = {},
): (...args: Args) => Promise<Result> {
  const { fallback = '调用本地服务失败', requireRuntime = true } = options;

  return async (...args: Args): Promise<Result> => {
    if (requireRuntime) {
      assertWailsRuntime();
    }

    try {
      return await fn(...args);
    } catch (cause) {
      throw normalizeBridgeError(cause, fallback);
    }
  };
}
