import js from '@eslint/js';
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting';
import { defineConfig, globalIgnores } from 'eslint/config';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';

export default defineConfig([
  globalIgnores([
    '**/dist/**',
    '**/node_modules/**',
    '**/coverage/**',
    'bindings/**',
    'src/types/auto-imports.d.ts',
    'src/types/components.d.ts',
  ]),
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...js.configs.recommended,
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    // 类型感知 lint：可发现空值、误用 Promise 等仅靠语法规则查不出的问题
    files: ['**/*.{ts,mts}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // .vue 需要 vue-eslint-parser 解析模板，内部脚本再交给 TS parser 做类型感知
    files: ['**/*.vue'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['src/tests/**/*.test.ts'],
    rules: {
      // 测试里以 obj.method 形式引用/断言 mock 是惯用写法，无需绑定 this
      '@typescript-eslint/unbound-method': 'off',
      // 测试会故意用非 Error 值拒绝/抛出，验证错误归一化路径
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
    },
  },
  {
    rules: {
      // Vue 3 <script setup> 下组件名由文件名 / defineOptions 提供
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  skipFormatting,
]);
