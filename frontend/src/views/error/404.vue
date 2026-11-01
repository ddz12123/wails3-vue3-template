<script setup lang="ts">
import { ROUTE_NAMES } from '@/constant';
import { useRouter } from 'vue-router';

defineOptions({ name: 'NotFound' });

const router = useRouter();

function goHome(): void {
  void router.replace({ name: ROUTE_NAMES.HOME });
}
</script>

<template>
  <div class="not-found">
    <el-result icon="warning" title="404" sub-title="页面不存在或已被移动">
      <template #extra>
        <el-button type="primary" @click="goHome">返回首页</el-button>
      </template>
    </el-result>
  </div>
</template>

<style scoped lang="scss">
.not-found {
  display: grid;
  place-items: center;
  height: 100%;
  overflow-y: auto;
  background: var(--app-bg-color);
}
</style>
