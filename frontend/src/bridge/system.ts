import { Browser, Clipboard, System } from '@wailsio/runtime';
import { createBridgeCall } from './call';
import { BridgeError } from './error';

export type EnvironmentInfo = System.EnvironmentInfo;

/** 用系统默认浏览器打开链接（仅允许 http/https） */
export const openExternal = createBridgeCall(
  (url: string) => {
    const target = new URL(url);

    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      throw new BridgeError('仅支持打开 http/https 链接', 'validation');
    }

    return Browser.OpenURL(target.toString());
  },
  { fallback: '打开外部链接失败' },
);

/** 写入系统剪贴板 */
export const copyText = createBridgeCall((text: string) => Clipboard.SetText(text), {
  fallback: '写入剪贴板失败',
});

/** 读取系统剪贴板 */
export const readText = createBridgeCall(() => Clipboard.Text(), {
  fallback: '读取剪贴板失败',
});

/** 获取系统环境信息（OS、Arch、Debug 等） */
export const getEnvironment = createBridgeCall(() => System.Environment(), {
  fallback: '获取系统环境信息失败',
});

/** 系统当前是否处于深色模式 */
export const isSystemDark = createBridgeCall(() => System.IsDarkMode(), {
  fallback: '获取系统主题失败',
});

/**
 * 平台判断（同步方法，不依赖 Wails 请求，浏览器中也可安全调用）。
 * Go 后端需要按平台分支时，请在 Go 侧使用 runtime.GOOS。
 */
export const platform = {
  isWindows: () => System.IsWindows(),
  isLinux: () => System.IsLinux(),
  isMac: () => System.IsMac(),
  isIOS: () => System.IsIOS(),
  isAndroid: () => System.IsAndroid(),
  isMobile: () => System.IsMobile(),
  isDesktop: () => System.IsDesktop(),
  isAMD64: () => System.IsAMD64(),
  isARM64: () => System.IsARM64(),
} as const;
