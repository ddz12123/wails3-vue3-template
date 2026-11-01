/**
 * localStorage 统一前缀，避免与其他应用/站点冲突。
 * 值包含项目短名（wails3-vue3-template），scripts/init.mjs 初始化时会随
 * projectSlug 一并替换，无需手动修改。
 */
export const STORAGE_PREFIX = 'wails3-vue3-template:';

/** 给存储 key 添加统一前缀 */
export function withStoragePrefix(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

/** 业务存储 key（不带前缀，交给 storage 工具统一加） */
export const STORAGE_KEYS = {
  SETTING: 'setting',
} as const;

/** Pinia 等需要直接写 localStorage 的场景，使用带前缀的完整 key */
export const PERSIST_KEYS = {
  SETTING: withStoragePrefix(STORAGE_KEYS.SETTING),
} as const;

/** 路由名称集中管理，便于跳转时获得类型提示 */
export const ROUTE_NAMES = {
  HOME: 'Home',
  NOT_FOUND: 'NotFound',
} as const;
