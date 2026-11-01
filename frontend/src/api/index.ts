/**
 * API 层统一出口。
 *
 * 业务接口按领域拆到 `src/api/<domain>.ts`，只在域模块里依赖 http，
 * 不要在 views/components 中直接发请求。用法见 README「请求封装」。
 */
export { ApiError, http, setUnauthorizedHandler } from '@/utils/request';
export type { ApiResponse, RequestConfig } from '@/utils/request';
