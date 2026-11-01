import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getWailsEnvironment,
  isWailsRuntime,
  WAILS_RUNTIME_READY_EVENT,
  whenWailsRuntimeReady,
} from '@/bridge/runtime';

interface TestWindow extends Window {
  _wails?: { environment?: { OS?: string; Arch?: string; Debug?: boolean } };
}

const testWindow = window as TestWindow;

function resetRuntime(): void {
  delete testWindow._wails;
  vi.useRealTimers();
}

describe('runtime', () => {
  afterEach(resetRuntime);

  it('detects the Wails runtime from window._wails.environment', () => {
    expect(isWailsRuntime()).toBe(false);

    testWindow._wails = { environment: { OS: 'windows', Arch: 'amd64', Debug: false } };

    expect(isWailsRuntime()).toBe(true);
    expect(getWailsEnvironment()?.OS).toBe('windows');
  });

  it('resolves immediately when the runtime is already ready', async () => {
    testWindow._wails = { environment: { OS: 'windows' } };

    await expect(whenWailsRuntimeReady(10)).resolves.toBe(true);
  });

  it('resolves true when the ready event arrives', async () => {
    const ready = whenWailsRuntimeReady(1000);

    testWindow._wails = { environment: { OS: 'windows' } };
    window.dispatchEvent(new Event(WAILS_RUNTIME_READY_EVENT));

    await expect(ready).resolves.toBe(true);
  });

  it('resolves false after the timeout in browser preview', async () => {
    vi.useFakeTimers();

    const ready = whenWailsRuntimeReady(1000);
    await vi.advanceTimersByTimeAsync(1000);

    await expect(ready).resolves.toBe(false);
  });
});
