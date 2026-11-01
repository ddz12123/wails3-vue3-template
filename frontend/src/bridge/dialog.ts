import { Dialogs } from '@wailsio/runtime';
import { createBridgeCall } from './call';

export type OpenFileDialogOptions = Dialogs.OpenFileDialogOptions;
export type SaveFileDialogOptions = Dialogs.SaveFileDialogOptions;
export type MessageDialogOptions = Dialogs.MessageDialogOptions;
export type FileFilter = Dialogs.FileFilter;

/** 选择单个文件，取消时返回空字符串 */
export const openFile = createBridgeCall(
  (options: OpenFileDialogOptions = {}) =>
    Dialogs.OpenFile({
      ...options,
      AllowsMultipleSelection: false,
    }),
  { fallback: '打开文件选择框失败' },
);

/** 选择多个文件，取消时返回空数组 */
export const openFiles = createBridgeCall(
  (options: OpenFileDialogOptions = {}) =>
    Dialogs.OpenFile({
      ...options,
      AllowsMultipleSelection: true,
    }),
  { fallback: '打开文件选择框失败' },
);

/** 选择目录，取消时返回空字符串 */
export const openDirectory = createBridgeCall(
  (options: OpenFileDialogOptions = {}) =>
    Dialogs.OpenFile({
      ...options,
      CanChooseDirectories: true,
      CanChooseFiles: false,
      AllowsMultipleSelection: false,
    }),
  { fallback: '打开目录选择框失败' },
);

/** 保存文件对话框，取消时返回空字符串 */
export const saveFile = createBridgeCall(
  (options: SaveFileDialogOptions = {}) => Dialogs.SaveFile(options),
  { fallback: '打开保存对话框失败' },
);

export const showInfo = createBridgeCall((options: MessageDialogOptions) => Dialogs.Info(options), {
  fallback: '打开信息对话框失败',
});

export const showWarning = createBridgeCall(
  (options: MessageDialogOptions) => Dialogs.Warning(options),
  { fallback: '打开警告对话框失败' },
);

export const showError = createBridgeCall(
  (options: MessageDialogOptions) => Dialogs.Error(options),
  { fallback: '打开错误对话框失败' },
);

const askQuestion = createBridgeCall((options: MessageDialogOptions) => Dialogs.Question(options), {
  fallback: '打开确认对话框失败',
});

/** 确认框按钮文案固定，保证返回值可以稳定判断（需要自定义按钮请直接使用 Dialogs.Question） */
const CONFIRM_LABELS = {
  cancel: { Label: '取消', IsCancel: true },
  confirm: { Label: '确定', IsDefault: true },
} as const;

/** 原生确认框：确定返回 true，取消返回 false */
export async function confirm(options: MessageDialogOptions): Promise<boolean> {
  const result = await askQuestion({
    Title: '请确认',
    ...options,
    Buttons: [CONFIRM_LABELS.cancel, CONFIRM_LABELS.confirm],
  });

  return result === CONFIRM_LABELS.confirm.Label;
}
