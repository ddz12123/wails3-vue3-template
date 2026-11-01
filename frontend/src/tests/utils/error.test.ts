import { describe, expect, it, vi } from 'vitest';
import { BridgeError } from '@/bridge/error';
import { ApiError } from '@/utils/request';
import { resolveErrorMessage } from '@/utils/error';

vi.mock('@/utils/message', () => ({
  message: {
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    confirm: vi.fn(),
  },
}));

describe('resolveErrorMessage', () => {
  it('hides internal bridge errors behind the fallback', () => {
    const error = new BridgeError('GetAppInfo: panic: secret detail', 'runtime');

    expect(resolveErrorMessage(error, '加载失败')).toBe('加载失败');
  });

  it('shows controlled validation and business messages', () => {
    expect(resolveErrorMessage(new BridgeError('名称不能为空', 'business'), '失败')).toBe(
      '名称不能为空',
    );
    expect(resolveErrorMessage(new BridgeError('仅支持 http/https', 'validation'), '失败')).toBe(
      '仅支持 http/https',
    );
  });

  it('gives a friendly hint outside the desktop runtime', () => {
    expect(resolveErrorMessage(new BridgeError('raw', 'not-ready'), '失败')).toContain('桌面环境');
  });

  it('keeps ApiError messages', () => {
    expect(resolveErrorMessage(new ApiError('登录状态已失效', 401), '失败')).toBe('登录状态已失效');
  });

  it('uses fallback for unknown errors', () => {
    expect(resolveErrorMessage(new Error('raw stack'), '保存失败')).toBe('保存失败');
  });
});
