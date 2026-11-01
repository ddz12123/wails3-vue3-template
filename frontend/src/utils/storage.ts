import { withStoragePrefix } from '@/constant';

/**
 * 带统一前缀与 JSON 序列化的 localStorage 封装。
 *
 * Pinia 的持久化数据由 pinia-plugin-persistedstate 管理，
 * 这里适合存放少量不属于 store 的键值。
 */
export const storage = {
  get<T>(key: string, fallback: T): T {
    if (typeof localStorage === 'undefined') {
      return fallback;
    }

    try {
      const raw = localStorage.getItem(withStoragePrefix(key));
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch (error) {
      console.warn('[storage] 读取失败:', error);
      return fallback;
    }
  },

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(withStoragePrefix(key), JSON.stringify(value));
    } catch (error) {
      console.warn('[storage] 写入失败:', error);
    }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(withStoragePrefix(key));
    } catch (error) {
      console.warn('[storage] 删除失败:', error);
    }
  },

  /** 仅清理本应用前缀下的数据 */
  clear(): void {
    try {
      Object.keys(localStorage)
        .filter((key) => key.startsWith(withStoragePrefix('')))
        .forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      console.warn('[storage] 清理失败:', error);
    }
  },
};
