import request from '@/utils/request';

export interface RegisteredUser {
  id: number;
  username: string;
  nickname: string;
  userMode: string;
  college: string;
  major: string;
  grade: number;
  phone: string;
  status: number;
  createTime: string;
  updateTime: string;
}


export interface UserStatistics {
  registeredUsers: number;
  sessionUsers: number;
  freshCount: number;
  alumniCount: number;
  parentCount: number;
  researchCount: number;
  seniorCount: number;
  totalCheckins: number;
  totalFavorites: number;
  totalSpots: number;
  totalRoutes: number;
  totalActivities: number;
  totalChats: number;
  totalReserves: number;
  totalFeedbacks: number;
}

export interface PageResult<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
}

export interface Result<T> {
  code: number;
  message: string;
  data: T;
}

export interface ListParams {
  page: number;
  size: number;
  userMode?: string;
  keyword?: string;
  status?: number;
  includeDisabled?: boolean;
}

export const getRegisteredUsers = (params: ListParams) => {
  return request.get<Result<PageResult<RegisteredUser>>>('/admin/users', { params });
};

export const getRegisteredUser = (id: number) => {
  return request.get<Result<RegisteredUser>>(`/admin/users/${id}`);
};

export const updateRegisteredUser = (id: number, data: Partial<RegisteredUser>) => {
  return request.put<Result<RegisteredUser>>(`/admin/users/${id}`, data);
};

export const updateRegisteredUserStatus = (id: number, status: number) => {
  return request.put<Result<RegisteredUser>>(`/admin/users/${id}/status`, null, { params: { status } });
};

export const deleteRegisteredUser = (id: number) => {
  return request.delete<Result<void>>(`/admin/users/${id}`);
};

export const getUserStatistics = () => {
  return request.get<Result<UserStatistics>>('/admin/statistics');
};

export const changeAdminPassword = (oldPassword: string, newPassword: string) => {
  return request.put<Result<void>>('/admin/password', { oldPassword, newPassword });
};
