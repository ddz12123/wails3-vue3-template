/**
 * 全局消息提示。
 *
 * ElMessage / ElMessageBox 由 unplugin-auto-import + ElementPlusResolver 自动导入，
 * 样式会随组件一起按需注入，无需额外引入 element-plus 全量 CSS。
 */
export const message = {
  success(content: string): void {
    ElMessage.success({ message: content, grouping: true });
  },

  info(content: string): void {
    ElMessage.info({ message: content, grouping: true });
  },

  warning(content: string): void {
    ElMessage.warning({ message: content, grouping: true });
  },

  error(content: string): void {
    ElMessage.error({ message: content, grouping: true });
  },

  /** 确认框：确定返回 true，取消/关闭返回 false；其他异常继续抛出 */
  async confirm(content: string, title = '提示'): Promise<boolean> {
    try {
      await ElMessageBox.confirm(content, title, {
        type: 'warning',
        confirmButtonText: '确定',
        cancelButtonText: '取消',
      });
      return true;
    } catch (error) {
      if (error === 'cancel' || error === 'close') {
        return false;
      }

      throw error;
    }
  },
};
