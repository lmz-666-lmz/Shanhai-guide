import request from '@/utils/request';

export interface UploadResult {
  url: string;
  filename: string;
}

export interface Result<T> {
  code: number;
  message: string;
  data: T;
}

export const uploadImage = (file: File): Promise<Result<UploadResult>> => {
  const formData = new FormData();
  formData.append('file', file);
  // 不手动设置 Content-Type，让浏览器自动生成含 boundary 的 multipart/form-data
  // 响应拦截器已 return response.data，实际返回的是 ApiResponse body（即 Result<UploadResult>），
  // 而非 AxiosResponse，因此做类型断言以匹配运行时行为
  return request.post('/admin/upload/image', formData) as unknown as Promise<Result<UploadResult>>;
};
