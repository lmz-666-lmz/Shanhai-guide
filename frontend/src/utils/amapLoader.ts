import AMapLoader from '@amap/amap-jsapi-loader';

declare global {
  interface Window {
    _AMapSecurityConfig?: {
      securityJsCode: string;
    };
  }
}

let amapPromise: Promise<any> | null = null;

export const loadAmapSdk = () => {
  if (typeof window === 'undefined') return Promise.reject(new Error('地图只能在浏览器中加载'));

  window._AMapSecurityConfig = {
    securityJsCode: '6e5ecf68aa8ff1dfe7c00bac49a2f2cc',
  };

  if (!amapPromise) {
    amapPromise = AMapLoader.load({
      key: '40d5237c9c83851a446150fdd697c90f',
      version: '2.0',
      plugins: ['AMap.Walking'],
    });
  }

  return amapPromise;
};
