/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 应用标题，用于页面标题等场景 */
  readonly VITE_APP_TITLE: string;
  /** 当前环境标识 */
  readonly VITE_APP_ENV: 'development' | 'production' | 'test';
  /** Axios 请求前缀；桌面构建建议填完整 URL，或留空走 Go 服务 */
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// 供 plain tsserver（如 ESLint 类型感知、vitest 类型解析）识别 .vue 导入；
// vue-tsc 会优先解析到真实组件类型，此声明只作为降级兜底。
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}
