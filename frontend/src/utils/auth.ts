import { Modal } from 'antd-mobile';
import type { UserSession } from '../types';
import { userApi } from '../api';

/**
 * 判断是否为普通游客（guest）身份
 */
export const isGuest = (session: UserSession | null): boolean => {
  return session?.userMode === 'guest';
};

/**
 * 核心功能拦截器：
 * 访客模式仅支持浏览，使用深度功能前进行拦截。
 */
export const requireAuth = async (session: UserSession | null, action: () => void | Promise<void>) => {
  if (!session) return;

  if (isGuest(session)) {
    Modal.confirm({
      title: '仅限正式或体验用户',
      content: '访客模式仅支持浏览导览内容，报名、收藏、打卡、AI 问答和个人中心功能需要登录或创建数字身份。',
      confirmText: '去登录 / 创建身份',
      cancelText: '继续浏览',
      onConfirm: () => {
        sessionStorage.removeItem('shanhai_session');
        window.location.reload();
      },
    });
  } else {
    try {
      await userApi.getSession(session.sessionId);
      await action();
    } catch {
      // 会话失效由请求层统一清理并通知 App，业务动作不再继续。
    }
  }
};
