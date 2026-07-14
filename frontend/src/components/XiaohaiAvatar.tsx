
export type AvatarStatus = 'idle' | 'listening' | 'thinking' | 'speaking' | 'navigating' | 'arrived';

interface Props {
  size?: 'small' | 'medium' | 'large' | number;
  status?: AvatarStatus;
  className?: string;
}

export default function XiaohaiAvatar({ size = 'medium', status = 'idle', className = '' }: Props) {
  const sizeMap = {
    small: 32,
    medium: 48,
    large: 64,
  };
  
  const dim = typeof size === 'number' ? size : sizeMap[size] || 48;

  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`} style={{ width: dim, height: dim }}>
      <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="xiaohai-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
          <linearGradient id="xiaohai-grad-glow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#93C5FD" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
        </defs>

        {/* Antennas */}
        <line x1="50" y1="25" x2="50" y2="15" stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />
        <circle cx="50" cy="12" r="5" fill={status === 'listening' ? '#F59E0B' : '#3B82F6'} >
          {status === 'thinking' && (
            <animate attributeName="fill" values="#3B82F6;#F59E0B;#3B82F6" dur="1s" repeatCount="indefinite" />
          )}
        </circle>

        {/* Head */}
        <rect x="15" y="25" width="70" height="56" rx="28" ry="28" fill={status === 'listening' ? 'url(#xiaohai-grad-glow)' : 'url(#xiaohai-grad)'} />
        
        {/* Face plate */}
        <rect x="25" y="35" width="50" height="36" rx="18" ry="18" fill="#FFFFFF" />
        
        {/* Eyes based on status */}
        {status === 'idle' && (
          <g>
            <circle cx="38" cy="53" r="5" fill="#1E3A8A">
              <animate attributeName="cy" values="53; 51; 53" dur="3s" repeatCount="indefinite" />
            </circle>
            <circle cx="62" cy="53" r="5" fill="#1E3A8A">
               <animate attributeName="cy" values="53; 51; 53" dur="3s" repeatCount="indefinite" />
            </circle>
          </g>
        )}
        
        {status === 'listening' && (
          <g>
            <circle cx="38" cy="53" r="6" fill="#2563EB">
              <animate attributeName="r" values="5;7;5" dur="1s" repeatCount="indefinite" />
            </circle>
            <circle cx="62" cy="53" r="6" fill="#2563EB">
               <animate attributeName="r" values="5;7;5" dur="1s" repeatCount="indefinite" />
            </circle>
          </g>
        )}

        {status === 'thinking' && (
          <g>
            <path d="M 32 53 Q 38 47 44 53" fill="none" stroke="#1E3A8A" strokeWidth="4" strokeLinecap="round">
              <animate attributeName="d" values="M 32 53 Q 38 47 44 53; M 32 51 Q 38 45 44 51; M 32 53 Q 38 47 44 53" dur="1s" repeatCount="indefinite"/>
            </path>
            <path d="M 56 53 Q 62 47 68 53" fill="none" stroke="#1E3A8A" strokeWidth="4" strokeLinecap="round">
              <animate attributeName="d" values="M 56 53 Q 62 47 68 53; M 56 51 Q 62 45 68 51; M 56 53 Q 62 47 68 53" dur="1s" repeatCount="indefinite"/>
            </path>
          </g>
        )}

        {status === 'navigating' && (
          <g>
            <circle cx="42" cy="53" r="5" fill="#1E3A8A" />
            <circle cx="66" cy="53" r="5" fill="#1E3A8A" />
            <path d="M 46 62 Q 50 64 54 62" fill="none" stroke="#1E3A8A" strokeWidth="2" strokeLinecap="round" />
          </g>
        )}

        {status === 'arrived' && (
          <g>
            <path d="M 32 53 Q 38 45 44 53" fill="none" stroke="#1E3A8A" strokeWidth="4" strokeLinecap="round" />
            <path d="M 56 53 Q 62 45 68 53" fill="none" stroke="#1E3A8A" strokeWidth="4" strokeLinecap="round" />
            <path d="M 42 62 Q 50 68 58 62" fill="none" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" />
          </g>
        )}
      </svg>
    </div>
  );
}
