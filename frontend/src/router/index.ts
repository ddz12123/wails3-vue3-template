import type { App } from 'vue';
import { ROUTE_NAMES } from '@/constant';
import NProgress from 'nprogress';
import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';
import 'nprogress/nprogress.css';

declare module 'vue-router' {
  interface RouteMeta {
    /** 页面标题，用于 document.title 与菜单展示 */
    title?: string;
  }
}

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: ROUTE_NAMES.HOME,
    component: () => import('@/views/home/index.vue'),
    meta: { title: '首页' },
  },
  {
    // 未知路径统一落到 404，避免白屏
    path: '/:pathMatch(.*)*',
    name: ROUTE_NAMES.NOT_FOUND,
    component: () => import('@/views/error/404.vue'),
    meta: { title: '页面不存在' },
  },
];

NProgress.configure({ showSpinner: false });

const router = createRouter({
  // 桌面应用使用 hash 模式，避免自定义协议下 history 路由刷新丢失
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach(() => {
  NProgress.start();
});

router.afterEach((to) => {
  NProgress.done();

  const appTitle = import.meta.env.VITE_APP_TITLE;
  document.title = to.meta.title ? `${to.meta.title} - ${appTitle}` : appTitle;
});

router.onError(() => {
  NProgress.done();
});

export function setupRouter(app: App): void {
  app.use(router);
}

export default router;
