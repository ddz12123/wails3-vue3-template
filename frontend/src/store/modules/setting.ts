import { PERSIST_KEYS } from '@/constant';
import { DEFAULT_PRIMARY_COLOR } from '@/constant/theme';
import { applyPrimaryColor } from '@/utils/color';
import { usePreferredDark } from '@vueuse/core';
import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';

export type ThemeMode = 'light' | 'dark' | 'system';

export const useSettingStore = defineStore(
  'setting',
  () => {
    const themeMode = ref<ThemeMode>('system');
    const primaryColor = ref(DEFAULT_PRIMARY_COLOR);

    // usePreferredDark 在 store 的 effect scope 内监听系统主题，
    // 生命周期跟随应用，不依赖具体组件。
    const systemDark = usePreferredDark();

    const isDark = computed(() =>
      themeMode.value === 'system' ? systemDark.value : themeMode.value === 'dark',
    );

    function setThemeMode(value: ThemeMode): void {
      themeMode.value = value;
    }

    /** 在浅色 / 深色之间切换（system 模式下按当前实际效果取反） */
    function toggleTheme(): void {
      themeMode.value = isDark.value ? 'light' : 'dark';
    }

    function setPrimaryColor(value: string): void {
      primaryColor.value = value;
    }

    // immediate 保证 store 创建时立即完成一次 DOM 同步，避免首屏闪烁
    watch(
      [isDark, primaryColor],
      ([dark, color]) => {
        document.documentElement.classList.toggle('dark', dark);
        applyPrimaryColor(color, dark);
      },
      { immediate: true },
    );

    return {
      themeMode,
      primaryColor,
      isDark,
      setThemeMode,
      toggleTheme,
      setPrimaryColor,
    };
  },
  {
    persist: {
      key: PERSIST_KEYS.SETTING,
      pick: ['themeMode', 'primaryColor'],
    },
  },
);
