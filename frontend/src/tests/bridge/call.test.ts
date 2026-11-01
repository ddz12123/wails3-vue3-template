import { afterEach, describe, expect, it } from 'vitest';
import { createBridgeCall } from '@/bridge/call';
import { BridgeError } from '@/bridge/error';

interface TestWindow extends Window {
  _wails?: { environment?: { OS?: string } };
}

const testWindow = window as TestWindow;

function setRuntimeReady(): void {
  testWindow._wails = { environment: { OS: 'windows' } };
}

describe('createBridgeCall', () => {
  afterEach(() => {
    delete testWindow._wails;
  });

  it('passes results through', async () => {
    setRuntimeReady();
    const call = createBridgeCall((name: string) => Promise.resolve(`hello ${name}`));

    await expect(call('wails')).resolves.toBe('hello wails');
  });

  it('rejects with not-ready outside the Wails runtime', async () => {
    const call = createBridgeCall(() => Promise.resolve('unreachable'));

    const error = await call().catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(BridgeError);
    expect((error as BridgeError).code).toBe('not-ready');
  });

  it('skips the runtime check when requireRuntime is false', async () => {
    const call = createBridgeCall(() => Promise.resolve('ok'), { requireRuntime: false });

    await expect(call()).resolves.toBe('ok');
  });

  it('maps structured Go business errors to BridgeError.business', async () => {
    setRuntimeReady();
    const cause = new Error('wrapped', {
      cause: { code: 'invalid_name', message: '名称不能为空' },
    });
    const call = createBridgeCall(() => Promise.reject(cause), { fallback: '问候失败' });

    const error = await call().catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(BridgeError);
    expect((error as BridgeError).code).toBe('business');
    expect((error as BridgeError).businessCode).toBe('invalid_name');
    expect((error as BridgeError).message).toBe('名称不能为空');
    expect((error as BridgeError).cause).toBe(cause);
  });

  it('maps plain errors to BridgeError.runtime keeping the message', async () => {
    setRuntimeReady();
    const call = createBridgeCall(() => Promise.reject(new Error('boom')), {
      fallback: '兜底文案',
    });

    const error = await call().catch((thrown: unknown) => thrown);

    expect((error as BridgeError).code).toBe('runtime');
    expect((error as BridgeError).message).toBe('boom');
  });

  it('maps thrown strings to BridgeError.runtime', async () => {
    setRuntimeReady();
    const call = createBridgeCall(() => Promise.reject('plain string error'));

    const error = await call().catch((thrown: unknown) => thrown);

    expect((error as BridgeError).code).toBe('runtime');
    expect((error as BridgeError).message).toBe('plain string error');
  });

  it('uses the fallback for unknown thrown values', async () => {
    setRuntimeReady();
    const call = createBridgeCall(() => Promise.reject(42), { fallback: '自定义兜底' });

    const error = await call().catch((thrown: unknown) => thrown);

    expect((error as BridgeError).code).toBe('unknown');
    expect((error as BridgeError).message).toBe('自定义兜底');
    expect((error as BridgeError).cause).toBe(42);
  });

  it('keeps BridgeError instances untouched', async () => {
    setRuntimeReady();
    const original = new BridgeError('已归一化', 'validation');
    const call = createBridgeCall(() => Promise.reject(original));

    const error = await call().catch((thrown: unknown) => thrown);

    expect(error).toBe(original);
  });
});
