import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

// 复用 Vite 的 alias、Vue/Element Plus 插件，避免测试环境与开发环境漂移。
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      // 单测统一放 src/tests/（按模块分子目录），新测试请放这里
      include: ['src/tests/**/*.test.ts'],
      restoreMocks: true,
      server: {
        deps: {
          // element-plus 的 ESM 入口带 .css 旁路导入，交由 Vite 处理（CSS 自动置空）
          inline: ['element-plus'],
        },
      },
      coverage: {
        provider: 'v8',
        reporter: ['text-summary', 'lcov'],
        // 覆盖率门禁只约束核心模块（视图层不在单测范围内）
        include: [
          'src/bridge/**/*.ts',
          'src/utils/**/*.ts',
          'src/store/**/*.ts',
          'src/api/**/*.ts',
          'src/constant/**/*.ts',
        ],
        exclude: ['src/**/*.test.ts'],
        thresholds: {
          lines: 85,
          functions: 85,
          branches: 80,
          statements: 85,
        },
      },
    },
  }),
);
