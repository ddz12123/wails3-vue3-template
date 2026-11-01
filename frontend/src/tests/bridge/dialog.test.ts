import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dialogs } from '@wailsio/runtime';
import {
  confirm,
  openDirectory,
  openFile,
  openFiles,
  saveFile,
  showError,
  showInfo,
  showWarning,
} from '@/bridge/dialog';

vi.mock('@wailsio/runtime', () => ({
  Dialogs: {
    OpenFile: vi.fn(),
    SaveFile: vi.fn(),
    Info: vi.fn(),
    Warning: vi.fn(),
    Error: vi.fn(),
    Question: vi.fn(),
  },
}));

interface TestWindow extends Window {
  _wails?: { environment?: { OS?: string } };
}

const testWindow = window as TestWindow;

describe('dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testWindow._wails = { environment: { OS: 'windows' } };
  });

  it('opens a single-file dialog', async () => {
    vi.mocked(Dialogs.OpenFile).mockResolvedValue('/tmp/a.txt');

    await expect(openFile({ Title: '选择文件' })).resolves.toBe('/tmp/a.txt');
    expect(vi.mocked(Dialogs.OpenFile).mock.calls[0]?.[0]).toMatchObject({
      Title: '选择文件',
      AllowsMultipleSelection: false,
    });
  });

  it('opens a multi-file dialog', async () => {
    vi.mocked(Dialogs.OpenFile).mockResolvedValue(['/tmp/a.txt', '/tmp/b.txt']);

    await expect(openFiles()).resolves.toEqual(['/tmp/a.txt', '/tmp/b.txt']);
    expect(vi.mocked(Dialogs.OpenFile).mock.calls[0]?.[0]).toMatchObject({
      AllowsMultipleSelection: true,
    });
  });

  it('opens a directory dialog', async () => {
    vi.mocked(Dialogs.OpenFile).mockResolvedValue('/tmp/dir');

    await expect(openDirectory()).resolves.toBe('/tmp/dir');
    expect(vi.mocked(Dialogs.OpenFile).mock.calls[0]?.[0]).toMatchObject({
      CanChooseDirectories: true,
      CanChooseFiles: false,
      AllowsMultipleSelection: false,
    });
  });

  it('opens a save dialog', async () => {
    vi.mocked(Dialogs.SaveFile).mockResolvedValue('/tmp/out.csv');

    await expect(saveFile({ Filename: 'out.csv' })).resolves.toBe('/tmp/out.csv');
    expect(Dialogs.SaveFile).toHaveBeenCalledWith({ Filename: 'out.csv' });
  });

  it('routes message dialogs to the matching primitive', async () => {
    vi.mocked(Dialogs.Info).mockResolvedValue('ok');
    vi.mocked(Dialogs.Warning).mockResolvedValue('ok');
    vi.mocked(Dialogs.Error).mockResolvedValue('ok');

    await showInfo({ Title: 'i', Message: 'm' });
    await showWarning({ Title: 'w', Message: 'm' });
    await showError({ Title: 'e', Message: 'm' });

    expect(Dialogs.Info).toHaveBeenCalled();
    expect(Dialogs.Warning).toHaveBeenCalled();
    expect(Dialogs.Error).toHaveBeenCalled();
  });

  it('resolves confirm to true when the confirm button is clicked', async () => {
    vi.mocked(Dialogs.Question).mockResolvedValue('确定');

    await expect(confirm({ Message: '确认删除？' })).resolves.toBe(true);

    const options = vi.mocked(Dialogs.Question).mock.calls[0]?.[0];
    expect(options?.Title).toBe('请确认');
    expect(options?.Buttons).toEqual([
      { Label: '取消', IsCancel: true },
      { Label: '确定', IsDefault: true },
    ]);
  });

  it('resolves confirm to false when cancelled', async () => {
    vi.mocked(Dialogs.Question).mockResolvedValue('取消');

    await expect(confirm({ Message: '确认删除？' })).resolves.toBe(false);
  });

  it('wraps dialog failures in BridgeError', async () => {
    vi.mocked(Dialogs.Question).mockRejectedValue(new Error('native failure'));

    const error = await confirm({ Message: 'x' }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).name).toBe('BridgeError');
    expect((error as Error).message).toBe('native failure');
  });
});
