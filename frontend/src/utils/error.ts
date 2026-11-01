import type { App } from 'vue';
import axios from 'axios';
import { BridgeError } from '@/bridge/error';
import { message } from './message';
import { ApiError } from './request';

/**
 * 全局错误兜底：
 * - Vue 组件渲染 / 生命周期 / 事件处理器中的未捕获异常
 * - 没有被 catch 的 Promise 拒绝
 *
 * 统一记录控制台日志并给出用户提示；接入监控上报时在此处补充。
 */
export function setupGlobalErrorHandler(app: App): void {
  app.config.errorHandler = (err, _instance, _info) => {
    handleError(err, '页面发生异常，请稍后重试');
  };

  window.addEventListener('unhandledrejection', (event) => {
    // 主动取消的请求不打扰用户
    if (axios.isCancel(event.reason)) {
      return;
    }

    handleError(event.reason, '发生未知错误，请稍后重试');

    // 已统一记录与提示，阻止浏览器再抛一次默认错误
    event.preventDefault();
  });
}

/**
 * 把异常转换为可展示给用户的文案。
 *
 * - 环境未就绪、内部 runtime 错误、未知错误：使用 fallback，避免泄露实现细节
 * - Go AppError / 前端 validation：使用受控的业务文案
 * - ApiError：保留服务端返回的用户级 message
 */
export function resolveErrorMessage(error: unknown, fallback = '操作失败'): string {
  if (error instanceof BridgeError) {
    switch (error.code) {
      case 'not-ready':
        return '当前不在 Wails 桌面环境中，请使用 wails3 dev 启动应用';
      case 'business':
      case 'validation':
        return error.message || fallback;
      default:
        return fallback;
    }
  }

  if (error instanceof ApiError) {
    return error.message || fallback;
  }

  return fallback;
}

/**
 * 统一错误处理：原始错误进控制台，用户只看到友好文案。
 *
 * @example
 * ```ts
 * try {
 *   await save();
 * } catch (error) {
 *   handleError(error, '保存失败');
 * }
 * ```
 */
export function handleError(error: unknown, fallback = '操作失败'): void {
  const isNotReady = error instanceof BridgeError && error.code === 'not-ready';
  if (!isNotReady) {
    console.error('[error]', error);
  }

  const text = resolveErrorMessage(error, fallback);
  if (isNotReady) {
    message.warning(text);
    return;
  }

  message.error(text);
}

/**
 * 包装异步函数：出错时统一提示，并继续向上抛出，
 * 便于调用方按需再做后续处理。
 */
export function withErrorHandler<T extends (...args: never[]) => Promise<unknown>>(
  fn: T,
  fallback?: string,
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, fallback);
      throw error;
    }
  }) as T;
}
