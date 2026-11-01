import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { DEFAULT_PRIMARY_COLOR } from '@/constant/theme';
import { useSettingStore } from '@/store/modules/setting';

describe('useSettingStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    document.documentElement.classList.remove('dark');
    document.documentElement.style.removeProperty('--el-color-primary');
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.style.removeProperty('--el-color-primary');
  });

  it('starts with system theme and the default primary color', () => {
    const store = useSettingStore();

    expect(store.themeMode).toBe('system');
    expect(store.primaryColor).toBe(DEFAULT_PRIMARY_COLOR);
    expect(store.isDark).toBe(false);
  });

  it('switches to dark mode and syncs the DOM', async () => {
    const store = useSettingStore();

    store.setThemeMode('dark');
    await nextTick();

    expect(store.isDark).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('switches back to light mode', () => {
    const store = useSettingStore();

    store.setThemeMode('dark');
    store.setThemeMode('light');

    expect(store.isDark).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('toggles the theme from the effective state', () => {
    const store = useSettingStore();

    store.toggleTheme();
    expect(store.themeMode).toBe('dark');

    store.toggleTheme();
    expect(store.themeMode).toBe('light');
  });

  it('applies the primary color to CSS variables', async () => {
    const store = useSettingStore();

    store.setPrimaryColor('#7c3aed');
    await nextTick();

    expect(document.documentElement.style.getPropertyValue('--el-color-primary')).toBe('#7c3aed');
    expect(store.primaryColor).toBe('#7c3aed');
  });
});
