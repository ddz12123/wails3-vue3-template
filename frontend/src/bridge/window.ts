import { Window } from '@wailsio/runtime';
import { createBridgeCall } from './call';

function action<Args extends unknown[]>(
  fn: (...args: Args) => Promise<void>,
  fallback: string,
): (...args: Args) => Promise<void> {
  return createBridgeCall(fn, { fallback });
}

function query<Result>(fn: () => Promise<Result>, fallback: string): () => Promise<Result> {
  return createBridgeCall(fn, { fallback });
}

/**
 * 当前窗口控制。
 *
 * 适合配合自定义标题栏（frameless 窗口）使用：
 * ```ts
 * await appWindow.minimize();
 * await appWindow.toggleMaximise();
 * ```
 */
export const appWindow = {
  minimize: action(() => Window.Minimise(), '窗口最小化失败'),
  unMinimize: action(() => Window.UnMinimise(), '窗口取消最小化失败'),
  toggleMaximise: action(() => Window.ToggleMaximise(), '窗口最大化切换失败'),
  maximize: action(() => Window.Maximise(), '窗口最大化失败'),
  unMaximize: action(() => Window.UnMaximise(), '窗口取消最大化失败'),
  isMaximised: query(() => Window.IsMaximised(), '获取窗口最大化状态失败'),
  toggleFullscreen: action(() => Window.ToggleFullscreen(), '全屏切换失败'),
  isFullscreen: query(() => Window.IsFullscreen(), '获取全屏状态失败'),
  center: action(() => Window.Center(), '窗口居中失败'),
  hide: action(() => Window.Hide(), '隐藏窗口失败'),
  show: action(() => Window.Show(), '显示窗口失败'),
  close: action(() => Window.Close(), '关闭窗口失败'),
  setTitle: action((title: string) => Window.SetTitle(title), '设置窗口标题失败'),
  setSize: action(
    (width: number, height: number) => Window.SetSize(width, height),
    '设置窗口大小失败',
  ),
  setMinSize: action(
    (width: number, height: number) => Window.SetMinSize(width, height),
    '设置窗口最小尺寸失败',
  ),
  setAlwaysOnTop: action(
    (alwaysOnTop: boolean) => Window.SetAlwaysOnTop(alwaysOnTop),
    '设置窗口置顶失败',
  ),
  openDevTools: action(() => Window.OpenDevTools(), '打开开发者工具失败'),
  reload: action(() => Window.Reload(), '刷新窗口失败'),
} as const;
