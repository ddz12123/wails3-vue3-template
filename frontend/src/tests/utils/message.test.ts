import { beforeEach, describe, expect, it, vi } from 'vitest';
import { message } from '@/utils/message';

// message.ts 由 ElementPlusResolver 自动导入，实际模块说明符为 element-plus/es。
// 这里用 vi.hoisted 保持 mock 松散类型，免于构造 element-plus 内部的复杂返回值类型。
const mocks = vi.hoisted(() => ({
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock('element-plus/es', () => ({
  ElMessage: {
    success: mocks.success,
    info: mocks.info,
    warning: mocks.warning,
    error: mocks.error,
  },
  ElMessageBox: {
    confirm: mocks.confirm,
  },
}));

describe('message', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes notifications to ElMessage with grouping', () => {
    message.success('ok');
    message.info('i');
    message.warning('w');
    message.error('e');

    expect(mocks.success).toHaveBeenCalledWith({ message: 'ok', grouping: true });
    expect(mocks.info).toHaveBeenCalledWith({ message: 'i', grouping: true });
    expect(mocks.warning).toHaveBeenCalledWith({ message: 'w', grouping: true });
    expect(mocks.error).toHaveBeenCalledWith({ message: 'e', grouping: true });
  });

  it('resolves confirm to true on accept', async () => {
    mocks.confirm.mockResolvedValue({ value: '', action: 'confirm' });

    await expect(message.confirm('继续？')).resolves.toBe(true);
    expect(mocks.confirm).toHaveBeenCalledWith('继续？', '提示', expect.any(Object));
  });

  it('resolves confirm to false on cancel or close', async () => {
    mocks.confirm.mockRejectedValue('cancel');
    await expect(message.confirm('继续？')).resolves.toBe(false);

    mocks.confirm.mockRejectedValue('close');
    await expect(message.confirm('继续？')).resolves.toBe(false);
  });

  it('rethrows unexpected confirm failures', async () => {
    const boom = new Error('boom');
    mocks.confirm.mockRejectedValue(boom);

    await expect(message.confirm('继续？')).rejects.toBe(boom);
  });
});
