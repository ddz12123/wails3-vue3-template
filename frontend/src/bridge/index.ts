/**
 * Wails 桥接层统一出口。
 *
 * 分层约定：
 * - `call.ts`：所有调用的统一包装（环境校验 + 错误归一化）
 * - `services.ts`：Go 服务（bindings）的类型化封装（按需新建）
 * - `window.ts`：窗口管理
 * - `dialog.ts`：系统原生对话框
 * - `system.ts`：外链、剪贴板、环境信息
 */
export { createBridgeCall } from './call';
export type { BridgeCallOptions } from './call';

export { BridgeError, normalizeBridgeError } from './error';
export type { BridgeErrorCode, BridgeErrorOptions } from './error';

export {
  assertWailsRuntime,
  getWailsEnvironment,
  isWailsRuntime,
  WAILS_RUNTIME_READY_EVENT,
  whenWailsRuntimeReady,
} from './runtime';

export { appWindow } from './window';
export {
  confirm,
  openDirectory,
  openFile,
  openFiles,
  saveFile,
  showError,
  showInfo,
  showWarning,
} from './dialog';
export type {
  FileFilter,
  MessageDialogOptions,
  OpenFileDialogOptions,
  SaveFileDialogOptions,
} from './dialog';

export { copyText, getEnvironment, isSystemDark, openExternal, platform, readText } from './system';
export type { EnvironmentInfo } from './system';
