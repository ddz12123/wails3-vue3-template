import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Browser, Clipboard, System } from '@wailsio/runtime';
import { BridgeError } from '@/bridge/error';
import {
  copyText,
  getEnvironment,
  isSystemDark,
  openExternal,
  platform,
  readText,
} from '@/bridge/system';

vi.mock('@wailsio/runtime', () => ({
  Browser: { OpenURL: vi.fn() },
  Clipboard: { SetText: vi.fn(), Text: vi.fn() },
  System: {
    Environment: vi.fn(),
    IsDarkMode: vi.fn(),
    IsWindows: vi.fn(),
    IsLinux: vi.fn(),
    IsMac: vi.fn(),
    IsIOS: vi.fn(),
    IsAndroid: vi.fn(),
    IsMobile: vi.fn(),
    IsDesktop: vi.fn(),
    IsAMD64: vi.fn(),
    IsARM64: vi.fn(),
  },
}));

interface TestWindow extends Window {
  _wails?: { environment?: { OS?: string } };
}

const testWindow = window as TestWindow;

describe('system', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testWindow._wails = { environment: { OS: 'windows' } };
  });

  it('opens http/https links in the system browser', async () => {
    await openExternal('https://v3.wails.io/docs');

    expect(Browser.OpenURL).toHaveBeenCalledWith('https://v3.wails.io/docs');
  });

  it('rejects non-http protocols before calling the runtime', async () => {
    const error = await openExternal('file:///etc/passwd').catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(BridgeError);
    expect((error as BridgeError).code).toBe('validation');
    expect((error as BridgeError).message).toBe('仅支持打开 http/https 链接');
    expect(Browser.OpenURL).not.toHaveBeenCalled();
  });

  it('wraps malformed URLs in BridgeError', async () => {
    const error = await openExternal('not a url').catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(BridgeError);
    expect((error as BridgeError).code).toBe('runtime');
    expect(Browser.OpenURL).not.toHaveBeenCalled();
  });

  it('reads and writes the clipboard', async () => {
    vi.mocked(Clipboard.Text).mockResolvedValue('copied');

    await copyText('copied');
    await expect(readText()).resolves.toBe('copied');

    expect(Clipboard.SetText).toHaveBeenCalledWith('copied');
    expect(Clipboard.Text).toHaveBeenCalled();
  });

  it('fetches environment info and dark-mode state', async () => {
    const env = {
      OS: 'windows',
      Arch: 'amd64',
      Debug: false,
      OSInfo: { Branding: 'Windows', ID: 'windows', Name: 'Windows', Version: '11' },
      PlatformInfo: {},
    };
    vi.mocked(System.Environment).mockResolvedValue(env);
    vi.mocked(System.IsDarkMode).mockResolvedValue(true);

    await expect(getEnvironment()).resolves.toEqual(env);
    await expect(isSystemDark()).resolves.toBe(true);
  });

  it('exposes synchronous platform helpers', () => {
    const flags = [
      System.IsWindows,
      System.IsLinux,
      System.IsMac,
      System.IsIOS,
      System.IsAndroid,
      System.IsMobile,
      System.IsDesktop,
      System.IsAMD64,
      System.IsARM64,
    ] as const;
    flags.forEach((flag) => vi.mocked(flag).mockReturnValue(true));

    expect(platform.isWindows()).toBe(true);
    expect(platform.isLinux()).toBe(true);
    expect(platform.isMac()).toBe(true);
    expect(platform.isIOS()).toBe(true);
    expect(platform.isAndroid()).toBe(true);
    expect(platform.isMobile()).toBe(true);
    expect(platform.isDesktop()).toBe(true);
    expect(platform.isAMD64()).toBe(true);
    expect(platform.isARM64()).toBe(true);
    flags.forEach((flag) => expect(flag).toHaveBeenCalled());
  });
});
