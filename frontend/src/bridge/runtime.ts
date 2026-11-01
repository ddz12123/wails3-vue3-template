import { BridgeError } from './error';

/** Wails 注入完运行环境后派发的事件 */
export const WAILS_RUNTIME_READY_EVENT = 'wails:runtime-config-ready';

/** Wails 在页面里注入的运行时信息 */
interface WailsEnvironment {
  OS?: string;
  Arch?: string;
  Debug?: boolean;
}

interface WailsGlobal {
  environment?: WailsEnvironment;
}

function getWailsGlobal(): WailsGlobal | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return (window as Window & { _wails?: WailsGlobal })._wails;
}

/**
 * 是否运行在 Wails 中。
 *
 * Wails 会在页面加载完成后注入 `window._wails.environment`；
 * 直接用浏览器打开 `vite dev` 时该字段不存在，可据此给出友好提示或启用 mock。
 */
export function isWailsRuntime(): boolean {
  return Boolean(getWailsGlobal()?.environment);
}

/** 获取 Wails 注入的运行环境信息（可能为 undefined） */
export function getWailsEnvironment(): WailsEnvironment | undefined {
  return getWailsGlobal()?.environment;
}

/**
 * 等待 Wails 运行环境就绪。
 *
 * Wails 在页面加载完成后才注入 `_wails.environment`，首屏 setup 阶段直接判断可能过早。
 * 浏览器预览等非 Wails 环境会在超时后返回 false。
 */
export function whenWailsRuntimeReady(timeout = 1500): Promise<boolean> {
  if (isWailsRuntime()) {
    return Promise.resolve(true);
  }

  if (typeof window === 'undefined') {
    return Promise.resolve(false);
  }

  return new Promise<boolean>((resolve) => {
    let timer = 0;

    const onReady = (): void => {
      window.clearTimeout(timer);
      resolve(isWailsRuntime());
    };

    timer = window.setTimeout(() => {
      window.removeEventListener(WAILS_RUNTIME_READY_EVENT, onReady);
      resolve(isWailsRuntime());
    }, timeout);

    window.addEventListener(WAILS_RUNTIME_READY_EVENT, onReady, { once: true });
  });
}

/** 断言当前处于 Wails 运行环境，否则抛出可读性更好的错误 */
export function assertWailsRuntime(): void {
  if (isWailsRuntime()) {
    return;
  }

  throw new BridgeError(
    '当前不在 Wails 运行环境中，无法调用本地能力。请使用 `wails3 dev` 启动应用。',
    'not-ready',
  );
}
