import { afterEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_PREFIX, withStoragePrefix } from '@/constant';
import { storage } from '@/utils/storage';

/**
 * 测试环境里的 localStorage 可能缺失或不可用，
 * 这里提供浏览器 Storage 语义的内存实现（条目为可枚举自有属性，与真实 Storage 一致）。
 */
function createMemoryStorage(): Storage {
  const store: Record<string, unknown> = {};

  const define = (name: string, value: unknown): void => {
    Object.defineProperty(store, name, { configurable: true, enumerable: false, value });
  };

  define('getItem', (key: string): string | null => {
    const value = store[key];
    return typeof value === 'string' ? value : null;
  });
  define('setItem', (key: string, value: string): void => {
    store[key] = String(value);
  });
  define('removeItem', (key: string): void => {
    delete store[key];
  });
  define('clear', (): void => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  });
  define('key', (index: number): string | null => Object.keys(store)[index] ?? null);
  Object.defineProperty(store, 'length', {
    configurable: true,
    enumerable: false,
    get: () => Object.keys(store).length,
  });

  return store as unknown as Storage;
}

function installStorage(): Storage {
  const memory = createMemoryStorage();
  Object.defineProperty(window, 'localStorage', { configurable: true, value: memory });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memory });
  return memory;
}

describe('storage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stores values under the unified prefix as JSON', () => {
    installStorage();

    storage.set('user', { id: 1 });

    expect(localStorage.getItem(withStoragePrefix('user'))).toBe('{"id":1}');
  });

  it('reads values back with the typed fallback', () => {
    installStorage();
    storage.set('count', 42);

    expect(storage.get('count', 0)).toBe(42);
    expect(storage.get('missing', 'fallback')).toBe('fallback');
  });

  it('returns the fallback and warns on corrupted JSON', () => {
    installStorage();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem(withStoragePrefix('broken'), '{not-json');

    expect(storage.get('broken', 'safe')).toBe('safe');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('removes a single key', () => {
    installStorage();
    storage.set('temp', 1);
    storage.remove('temp');

    expect(localStorage.getItem(withStoragePrefix('temp'))).toBeNull();
  });

  it('clears only keys owned by the app', () => {
    installStorage();
    storage.set('a', 1);
    storage.set('b', 2);
    localStorage.setItem('other-app-key', 'keep');

    storage.clear();

    expect(Object.keys(localStorage).filter((key) => key.startsWith(STORAGE_PREFIX))).toHaveLength(
      0,
    );
    expect(localStorage.getItem('other-app-key')).toBe('keep');
  });

  it('does not throw when localStorage is unavailable', () => {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: undefined });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: undefined });

    expect(storage.get('x', 'fallback')).toBe('fallback');
    expect(() => storage.set('x', 1)).not.toThrow();
    expect(() => storage.remove('x')).not.toThrow();
    expect(() => storage.clear()).not.toThrow();

    installStorage();
  });
});
