import 'element-plus/theme-chalk/dark/css-vars.css';
import '@/styles/index.scss';

import { createApp } from 'vue';
import App from './App.vue';
import { setupRouter } from '@/router';
import { setupStore, useSettingStore } from '@/store';
import { setupGlobalErrorHandler } from '@/utils/error';

const app = createApp(App);

setupStore(app);
// 在挂载前初始化主题，避免浅色/深色闪烁
useSettingStore();
setupGlobalErrorHandler(app);
setupRouter(app);

app.mount('#app');
