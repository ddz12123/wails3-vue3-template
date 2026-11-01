import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Window } from '@wailsio/runtime';
import { BridgeError } from '@/bridge/error';
import { appWindow } from '@/bridge/window';

vi.mock('@wailsio/runtime', () => ({
  Window: {
    Minimise: vi.fn(),
    UnMinimise: vi.fn(),
    ToggleMaximise: vi.fn(),
    Maximise: vi.fn(),
    UnMaximise: vi.fn(),
    IsMaximised: vi.fn(),
    ToggleFullscreen: vi.fn(),
    IsFullscreen: vi.fn(),
    Center: vi.fn(),
    Hide: vi.fn(),
    Show: vi.fn(),
    Close: vi.fn(),
    SetTitle: vi.fn(),
    SetSize: vi.fn(),
    SetMinSize: vi.fn(),
    SetAlwaysOnTop: vi.fn(),
    OpenDevTools: vi.fn(),
    Reload: vi.fn(),
  },
}));

interface TestWindow extends Window {
  _wails?: { environment?: { OS?: string } };
}

const testWindow = window as TestWindow;

describe('appWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testWindow._wails = { environment: { OS: 'windows' } };
  });

  it('delegates window actions to the runtime', async () => {
    await appWindow.minimize();
    await appWindow.toggleMaximise();
    await appWindow.setTitle('hello');
    await appWindow.setSize(800, 600);

    expect(Window.Minimise).toHaveBeenCalledTimes(1);
    expect(Window.ToggleMaximise).toHaveBeenCalledTimes(1);
    expect(Window.SetTitle).toHaveBeenCalledWith('hello');
    expect(Window.SetSize).toHaveBeenCalledWith(800, 600);
  });

  it('returns query results', async () => {
    vi.mocked(Window.IsMaximised).mockResolvedValue(true);
    vi.mocked(Window.IsFullscreen).mockResolvedValue(false);

    await expect(appWindow.isMaximised()).resolves.toBe(true);
    await expect(appWindow.isFullscreen()).resolves.toBe(false);
  });

  it('wraps failures in BridgeError with the fallback message', async () => {
    vi.mocked(Window.Minimise).mockRejectedValue(new Error('native failure'));

    const error = await appWindow.minimize().catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(BridgeError);
    expect((error as BridgeError).message).toBe('native failure');
  });

  it('exposes the full window control surface', async () => {
    await appWindow.unMinimize();
    await appWindow.maximize();
    await appWindow.unMaximize();
    await appWindow.toggleFullscreen();
    await appWindow.center();
    await appWindow.hide();
    await appWindow.show();
    await appWindow.close();
    await appWindow.setMinSize(800, 600);
    await appWindow.setAlwaysOnTop(true);
    await appWindow.openDevTools();
    await appWindow.reload();
    await appWindow.isMaximised();
    await appWindow.isFullscreen();

    expect(Window.UnMinimise).toHaveBeenCalled();
    expect(Window.Maximise).toHaveBeenCalled();
    expect(Window.UnMaximise).toHaveBeenCalled();
    expect(Window.ToggleFullscreen).toHaveBeenCalled();
    expect(Window.Center).toHaveBeenCalled();
    expect(Window.Hide).toHaveBeenCalled();
    expect(Window.Show).toHaveBeenCalled();
    expect(Window.Close).toHaveBeenCalled();
    expect(Window.SetMinSize).toHaveBeenCalledWith(800, 600);
    expect(Window.SetAlwaysOnTop).toHaveBeenCalledWith(true);
    expect(Window.OpenDevTools).toHaveBeenCalled();
    expect(Window.Reload).toHaveBeenCalled();
    expect(Window.IsMaximised).toHaveBeenCalled();
    expect(Window.IsFullscreen).toHaveBeenCalled();
  });
});
