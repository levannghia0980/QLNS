import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, LogIn } from 'lucide-react';
import axios from 'axios';

export default function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@123');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await axios.post('/auth/login', {
        username: username.trim(),
        password: password
      });
      onLoginSuccess(res.data);
    } catch (err) {
      console.error('Login Error:', err);
      let msg = 'Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản & mật khẩu.';
      if (err.response?.data?.detail) {
        if (typeof err.response.data.detail === 'string') {
          msg = err.response.data.detail;
        } else if (Array.isArray(err.response.data.detail)) {
          msg = err.response.data.detail.map(d => d.msg || JSON.stringify(d)).join(', ');
        }
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #F4F6F9 0%, #E2E8F0 100%)',
      padding: 20
    }}>
      <div className="vt-card animate-fade-in" style={{
        width: '100%',
        maxWidth: 420,
        padding: 36,
        borderRadius: 16,
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        background: 'white'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img 
            src="/static/images/logo-1-2x-1.png" 
            alt="Viettel Software" 
            style={{ height: 38, marginBottom: 8 }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#EE0033' }}>viettel software</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748B', marginTop: 4 }}>Hệ thống quản trị nhân sự & thực tập sinh</p>
        </div>

        {error && (
          <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#1E293B', marginBottom: 6 }}>
              Tên đăng nhập
            </label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94A3B8' }} />
              <input 
                type="text" 
                className="vt-search-input"
                style={{ width: '100%', paddingLeft: 36 }}
                placeholder="Nhập tên đăng nhập"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#1E293B', marginBottom: 6 }}>
              Mật khẩu
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94A3B8' }} />
              <input 
                type={showPass ? 'text' : 'password'} 
                className="vt-search-input"
                style={{ width: '100%', paddingLeft: 36, paddingRight: 36 }}
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button 
                type="button" 
                style={{ position: 'absolute', right: 10, top: 10, border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8' }}
                onClick={() => setShowPass(!showPass)}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="vt-btn-primary" 
            style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: 8 }}
            disabled={loading}
          >
            <LogIn size={18} />
            <span>{loading ? 'Đang xác thực với Backend...' : 'Đăng nhập'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
