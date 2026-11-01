import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import wails from '@wailsio/runtime/plugins/vite';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import { defineConfig, type Plugin } from 'vite';

/**
 * 保证 dist 目录在构建后仍然存在。
 *
 * main.go 使用 `//go:embed all:frontend/dist`，如果 dist 目录不存在（例如刚克隆项目、
 * 尚未构建过前端），Go 语言服务器会报 `pattern all:frontend/dist: no matching files found`。
 * 构建结束后写入 .gitkeep，使该目录始终可被 embed 匹配。
 */
function keepDistDir(): Plugin {
  const distDir = fileURLToPath(new URL('./dist', import.meta.url));

  return {
    name: 'wails:keep-dist-dir',
    apply: 'build',
    closeBundle() {
      mkdirSync(distDir, { recursive: true });
      writeFileSync(new URL('./dist/.gitkeep', import.meta.url), '');
    },
  };
}

/**
 * 生产构建注入严格 CSP。
 *
 * Wails 运行时通过同源外部脚本（`/wails/runtime`、`/wails/custom.js`）加载，
 * 因此 `script-src 'self'` 可行；style 保留 'unsafe-inline' 以支持 Element Plus
 * 与主题系统写入的行内样式。开发模式不注入，避免限制 Vite dev server。
 */
const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // 桌面端可能直连业务后端（VITE_API_BASE_URL），放宽 connect 以保留该能力
  'connect-src *',
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function injectCsp(): Plugin {
  return {
    name: 'wails:inject-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler() {
        return [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: PRODUCTION_CSP },
            injectTo: 'head-prepend',
          },
        ];
      },
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  // 打包后的资源使用相对路径，避免自定义 scheme / 子路径下资源 404
  base: './',
  plugins: [
    vue(),
    // 生产构建注入严格 CSP（开发模式不注入）
    injectCsp(),
    // 保持 dist 目录存在，避免 Go embed 在未构建前端时找不到文件
    keepDistDir(),
    // Wails：自动把 ./bindings 里的 Go 绑定接入 Vite（含热更新）
    wails('./bindings'),
    // Vue / Vue Router / Pinia / VueUse 的 API 自动导入
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia', '@vueuse/core'],
      // ElMessage / ElMessageBox 等 Element Plus 组合式 API 的自动导入。
      // 保持默认 importStyle: 'css'：主题色/深色模式走运行时 CSS 变量（utils/color.ts），
      // 无需编译期 SCSS 变量；改 'sass' 会显著拖慢 dev 冷启动与构建。
      // 仅当需要定制 Element Plus 的 SCSS 变量（如 $--border-radius-base）时才切换。
      resolvers: [ElementPlusResolver()],
      dts: 'src/types/auto-imports.d.ts',
      vueTemplate: true,
    }),
    // Element Plus 组件按需注册（模板中直接写 <el-button> 即可）
    Components({
      resolvers: [ElementPlusResolver()],
      dts: 'src/types/components.d.ts',
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@bindings': fileURLToPath(new URL('./bindings', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: Number(process.env.WAILS_VITE_PORT) || 9245,
    strictPort: true,
    watch: {
      // unplugin 生成的类型声明不参与热更新，避免无意义的整页重载
      ignored: ['**/src/types/auto-imports.d.ts', '**/src/types/components.d.ts'],
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    // 保留体积告警，避免后续依赖膨胀被 2MB 阈值掩盖
    chunkSizeWarningLimit: 900,
  },
});
