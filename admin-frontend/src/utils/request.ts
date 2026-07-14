import axios from 'axios';

/* ---------- 认证失效统一处理 ---------- */
let isRedirecting = false;

function handleAuthFailure() {
  if (isRedirecting) return; // 防止多个请求同时触发重复跳转
  isRedirecting = true;
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_info');
  // 使用 replace 避免回退按钮回到已失效的管理页面
  window.location.replace('/login');
}

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
  timeout: 10000,
});

request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

request.interceptors.response.use(
  (response) => {
    const data = response.data as Record<string, unknown> | undefined;
    const code = data?.code;

    // 业务层错误码（非 200 即失败）
    if (code !== undefined && code !== 200) {
      // 认证失效 / 无权访问：直接跳转登录，不弹错误提示
      if (code === 401 || code === '401' || code === 403 || code === '403') {
        handleAuthFailure();
        return new Promise<never>(() => {}); // 永不 resolve/reject — 页面 catch 不会触发
      }
      return Promise.reject(new Error((data?.message as string) || '请求失败'));
    }

    return response.data;
  },
  (error) => {
    // HTTP 层面认证失效
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      handleAuthFailure();
      return new Promise<never>(() => {});
    }

    if (!error.response) {
      return Promise.reject(new Error('网络异常，请检查后端服务'));
    }
    if (error.response?.data?.message) {
      return Promise.reject(new Error(error.response.data.message));
    }
    return Promise.reject(error);
  },
);

export default request;
