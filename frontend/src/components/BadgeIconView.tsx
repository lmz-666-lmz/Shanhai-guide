import { useState } from 'react';
import type { Badge } from '../types';
import { resolveBadgeIcon } from '../utils/image';

interface BadgeIconViewProps {
  badge: Badge;
  size?: number;
  locked?: boolean;
  className?: string;
}

/**
 * 统一的徽章图标组件。
 * - 成就墙 (ProfilePage) 和获奖弹窗 (AchievementUnlockOverlay) 必须共用此组件。
 * - 优先级：badgeIcon 有值 → 显示后台设置的图片/图标
 * - 如果 /uploads/xxx.png → 解析为完整 URL
 * - 如果加载失败或为空 → 显示默认保底 SVG
 * - locked 状态下增加透明度 / 灰度，但图标源保持一致
 */
export default function BadgeIconView({ badge, size = 56, locked = false, className = '' }: BadgeIconViewProps) {
  const iconUrl = resolveBadgeIcon(badge.badgeIcon);
  const [imgFailed, setImgFailed] = useState(false);

  const showImage = iconUrl && !imgFailed;

  // 容器尺寸用 size，图标尺寸约为 size * 0.6
  const iconSize = Math.round(size * 0.55);
  const outerSize = size;

  const containerClass = `flex items-center justify-center rounded-full ${
    locked
      ? 'bg-slate-200 text-slate-400 grayscale opacity-60'
      : 'bg-gradient-to-br from-amber-100 to-amber-300 text-amber-700 shadow-sm'
  } ${className}`;

  const defaultBadgeSvg = (
    <svg
      className={`${locked ? 'text-slate-400' : 'text-amber-700'}`}
      width={iconSize}
      height={iconSize}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="6.5" />
      <path d="M8.5 13.4 7.5 22l4.5-2.7 4.5 2.7-1-8.6" />
      <path d="m9.5 8 1.6 1.6L14.8 6" />
    </svg>
  );

  return (
    <div className={containerClass} style={{ width: outerSize, height: outerSize }}>
      {showImage ? (
        <img
          src={iconUrl}
          alt={badge.badgeName || '徽章图标'}
          className="rounded-full object-cover"
          style={{ width: Math.round(size * 0.65), height: Math.round(size * 0.65) }}
          onError={() => setImgFailed(true)}
        />
      ) : (
        defaultBadgeSvg
      )}
    </div>
  );
}
