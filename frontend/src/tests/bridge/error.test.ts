import { describe, expect, it } from 'vitest';
import { BridgeError, normalizeBridgeError } from '@/bridge/error';
describe('normalizeBridgeError', () => {
  it('keeps an existing BridgeError', () => {
    const error = new BridgeError('用户可见文案', 'validation');
    expect(normalizeBridgeError(error)).toBe(error);
  });

  it('maps a structured Go error cause to business code', () => {
    const runtimeError = new Error('call failed');
    runtimeError.cause = { code: 'invalid_name', message: '名称不能为空' };

    const error = normalizeBridgeError(runtimeError);

    expect(error.code).toBe('business');
    expect(error.businessCode).toBe('invalid_name');
    expect(error.message).toBe('名称不能为空');
  });

  it('treats a plain Error as runtime error', () => {
    const error = normalizeBridgeError(new Error('boom'));

    expect(error.code).toBe('runtime');
    expect(error.message).toBe('boom');
  });

  it('falls back for unknown values', () => {
    const error = normalizeBridgeError({}, '默认文案');

    expect(error.code).toBe('unknown');
    expect(error.message).toBe('默认文案');
  });
});
