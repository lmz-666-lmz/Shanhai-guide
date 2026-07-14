import { useState, useEffect, useCallback } from 'react';
import { Form, Input, Button, Typography, Alert } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import request from '@/utils/request';

const { Title, Text } = Typography;

/* ---------- 浮动几何图形 ---------- */
const SHAPES = [
  { size: 120, x: '5%', y: '8%', delay: 0, duration: 18, color: 'rgba(255,255,255,0.06)' },
  { size: 80, x: '88%', y: '12%', delay: 2, duration: 15, color: 'rgba(255,255,255,0.05)' },
  { size: 160, x: '72%', y: '75%', delay: 4, duration: 22, color: 'rgba(255,255,255,0.04)' },
  { size: 100, x: '15%', y: '82%', delay: 1, duration: 20, color: 'rgba(255,255,255,0.05)' },
  { size: 60, x: '45%', y: '5%', delay: 3, duration: 16, color: 'rgba(255,255,255,0.07)' },
  { size: 200, x: '30%', y: '50%', delay: 6, duration: 25, color: 'rgba(255,255,255,0.03)' },
  { size: 90, x: '60%', y: '88%', delay: 5, duration: 19, color: 'rgba(255,255,255,0.05)' },
];

/* ---------- 粒子 ---------- */
interface Particle {
  id: number;
  left: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    size: 2 + Math.random() * 4,
    delay: Math.random() * 8,
    duration: 6 + Math.random() * 10,
    opacity: 0.15 + Math.random() * 0.35,
  }));
}

/* ---------- 装饰性 SVG 波浪 ---------- */
function WaveDecoration() {
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, pointerEvents: 'none', lineHeight: 0 }}>
      <svg viewBox="0 0 1440 200" preserveAspectRatio="none" style={{ width: '100%', height: 'auto' }}>
        <path
          fill="rgba(255,255,255,0.04)"
          d="M0,128L48,117.3C96,107,192,85,288,80C384,75,480,85,576,96C672,107,768,117,864,112C960,107,1056,85,1152,74.7C1248,64,1344,64,1392,64L1440,64L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
        />
        <path
          fill="rgba(255,255,255,0.06)"
          d="M0,160L48,149.3C96,139,192,117,288,122.7C384,128,480,160,576,170.7C672,181,768,171,864,154.7C960,139,1056,117,1152,112C1248,107,1344,117,1392,122.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
        />
      </svg>
    </div>
  );
}

/* ---------- 主组件 ---------- */
export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [particles] = useState(() => generateParticles(30));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const onFinish = useCallback(async (values: { username: string; password: string }) => {
    setLoading(true);
    setError('');
    try {
      const response = await request.post('/admin/login', values);
      localStorage.setItem('admin_token', response.data.token);
      localStorage.setItem('admin_info', JSON.stringify(response.data.admin));
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : '用户名或密码错误');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div style={styles.wrapper}>
      {/* ---- 动态渐变背景 ---- */}
      <div style={styles.bgGradient} />

      {/* ---- 浮动形状 ---- */}
      {SHAPES.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: s.size,
            height: s.size,
            left: s.x,
            top: s.y,
            borderRadius: i % 3 === 0 ? '50%' : i % 3 === 1 ? '30% 70% 70% 30% / 30% 30% 70% 70%' : '16px',
            background: s.color,
            animation: `floatShape ${s.duration}s ${s.delay}s ease-in-out infinite`,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* ---- 粒子 ---- */}
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            bottom: '-8px',
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: `rgba(255,255,255,${p.opacity})`,
            animation: `riseParticle ${p.duration}s ${p.delay}s linear infinite`,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* ---- 底部波浪 ---- */}
      <WaveDecoration />

      {/* ---- 登录卡片 ---- */}
      <div
        style={{
          ...styles.card,
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* 品牌区 */}
        <div style={styles.brandBlock}>
          <div style={styles.logoMark}>
            <svg viewBox="0 0 100 100" width="56" height="56" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="xm-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#93C5FD" />
                  <stop offset="100%" stopColor="#3B82F6" />
                </linearGradient>
              </defs>
              {/* 天线 */}
              <line x1="50" y1="25" x2="50" y2="15" stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />
              <circle cx="50" cy="12" r="5" fill="#3B82F6">
                <animate attributeName="fill" values="#3B82F6;#60A5FA;#3B82F6" dur="2s" repeatCount="indefinite" />
              </circle>
              {/* 头部 */}
              <rect x="15" y="25" width="70" height="56" rx="28" ry="28" fill="url(#xm-grad)" />
              {/* 脸部面板 */}
              <rect x="25" y="35" width="50" height="36" rx="18" ry="18" fill="#FFFFFF" />
              {/* 眼睛 */}
              <circle cx="38" cy="53" r="5" fill="#1E3A8A">
                <animate attributeName="cy" values="53;51;53" dur="3s" repeatCount="indefinite" />
              </circle>
              <circle cx="62" cy="53" r="5" fill="#1E3A8A">
                <animate attributeName="cy" values="53;51;53" dur="3s" repeatCount="indefinite" />
              </circle>
              {/* 微笑 */}
              <path d="M 42 62 Q 50 68 58 62" fill="none" stroke="#93C5FD" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <Title level={2} style={styles.brandTitle}>
            山海小导
          </Title>
          <Text style={styles.brandSub}>管理后台</Text>
          <div style={styles.divider}>
            <span style={styles.dividerDot} />
            <span style={styles.dividerLine} />
            <span style={styles.dividerDot} />
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            closable
            onClose={() => setError('')}
            style={styles.alert}
          />
        )}

        {/* 表单 */}
        <Form name="login" onFinish={onFinish} size="large" style={styles.form}>
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input
              prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
              placeholder="用户名"
              style={styles.input}
            />
          </Form.Item>

          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password
              prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
              placeholder="密码"
              style={styles.input}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              style={styles.button}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                (e.currentTarget as HTMLElement).style.boxShadow =
                  '0 8px 25px rgba(26,92,138,0.45)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLElement).style.boxShadow =
                  '0 4px 15px rgba(26,92,138,0.3)';
              }}
            >
              登 录
            </Button>
          </Form.Item>
        </Form>

        {/* 底部提示 */}
        <Text style={styles.footerHint}>
          山海小导 · 智能文旅管理平台
        </Text>
      </div>

      {/* ---- 全局关键帧动画 ---- */}
      <style>{`
        @keyframes floatShape {
          0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
          25% { transform: translate(12px, -16px) rotate(3deg) scale(1.05); }
          50% { transform: translate(-8px, -28px) rotate(-2deg) scale(0.97); }
          75% { transform: translate(-14px, -10px) rotate(1deg) scale(1.03); }
        }
        @keyframes riseParticle {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 0.6; }
          100% { transform: translateY(-100vh) scale(0.3); opacity: 0; }
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}

/* ---------- 样式 ---------- */
const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'relative',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },

  bgGradient: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(-45deg, #0f344e, #1a5c8a, #2563eb, #0f344e)',
    backgroundSize: '400% 400%',
    animation: 'gradientShift 12s ease infinite',
    zIndex: 0,
  },

  card: {
    position: 'relative',
    zIndex: 2,
    width: 420,
    padding: '44px 40px 36px',
    borderRadius: 20,
    background: 'rgba(255,255,255,0.88)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.2) inset',
  },

  brandBlock: {
    textAlign: 'center',
    marginBottom: 28,
  },

  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 20,
    background: 'rgba(255,255,255,0.95)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
    boxShadow: '0 8px 24px rgba(26,92,138,0.2)',
  },

  brandTitle: {
    marginBottom: 4,
    fontSize: 26,
    fontWeight: 800,
    background: 'linear-gradient(135deg, #0f344e, #1a5c8a)',
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    letterSpacing: 4,
  },

  brandSub: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: 500,
    letterSpacing: 6,
    textTransform: 'uppercase',
  },

  divider: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },

  dividerDot: {
    width: 4,
    height: 4,
    borderRadius: '50%',
    background: '#cbd5e1',
    display: 'inline-block',
  },

  dividerLine: {
    width: 32,
    height: 1,
    background: '#e2e8f0',
    display: 'inline-block',
  },

  alert: {
    marginBottom: 20,
    borderRadius: 10,
    border: 'none',
    background: 'rgba(239,68,68,0.08)',
  },

  form: {
    marginTop: 0,
  },

  input: {
    borderRadius: 10,
    height: 46,
    border: '1px solid #e2e8f0',
    background: 'rgba(248,250,252,0.8)',
    transition: 'all 0.2s',
    fontSize: 14,
  },

  button: {
    width: '100%',
    height: 46,
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 600,
    letterSpacing: 8,
    background: 'linear-gradient(135deg, #1a5c8a, #2563eb)',
    border: 'none',
    boxShadow: '0 4px 15px rgba(26,92,138,0.3)',
    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    marginTop: 4,
  },

  footerHint: {
    display: 'block',
    textAlign: 'center',
    marginTop: 24,
    fontSize: 12,
    color: '#94a3b8',
    letterSpacing: 1,
  },
};
