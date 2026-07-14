import request from '@/utils/request';

export interface CampusSpot {
  id: number;
  spotName: string;
  spotType: string;
  longitude: number;
  latitude: number;
  openTime: string;
  recommendTime: number;
  spotDesc: string;
  spotImage: string;
  suitableMode: string;
  isEnable: number;
  createTime: string;
  updateTime: string;
}

export interface Result<T> {
  code: number;
  message: string;
  data: T;
}

export const getSpots = (includeDisabled = false) => {
  return request.get<Result<CampusSpot[]>>('/admin/spots', { params: { includeDisabled } });
};
