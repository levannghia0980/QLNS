import React, { useState, useEffect, useRef } from 'react';
import { X, User, Lock, Save, Key, CheckCircle, AlertCircle, LogOut, Globe, LogIn, Trash2, FileText, Upload, Code } from 'lucide-react';
import axios from 'axios';

export default function ProfileModal({ isOpen, onClose, currentUser, onLogout, onProfileUpdated }) {
  const [activeTab, setActiveTab] = useState('info'); // 'info' | 'password' | 'google'
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Change password form
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passMsg, setPassMsg] = useState({ text: '', type: '' });
  const [passLoading, setPassLoading] = useState(false);

  // Update profile form
  const [editForm, setEditForm] = useState({});
  const [infoMsg, setInfoMsg] = useState({ text: '', type: '' });
  const [infoLoading, setInfoLoading] = useState(false);

  // Google OAuth State
  const [googleStatus, setGoogleStatus] = useState({ connected: false, email: '', client_id: '', client_secret: '' });
  const [clientIdInput, setClientIdInput] = useState('');
  const [clientSecretInput, setClientSecretInput] = useState('');
  const [jsonTextInput, setJsonTextInput] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [configSuccess, setConfigSuccess] = useState('');
  const [envSaveLoading, setEnvSaveLoading] = useState(false);

  const jsonFileInputRef = useRef(null);
  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    if (isOpen) {
      fetchProfile();
      if (isAdmin) fetchGoogleStatus();
      setPassMsg({ text: '', type: '' });
      setInfoMsg({ text: '', type: '' });
    }
  }, [isOpen]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/users/me');
      setProfile(res.data);
      setEditForm({
        full_name: res.data.full_name || '',
        viettel_email: res.data.viettel_email || '',
        phone: res.data.phone || '',
        hometown: res.data.hometown || '',
        bank_name: res.data.bank_name || '',
        bank_account: res.data.bank_account || '',
      });
    } catch (err) {
      console.warn('Using local user data fallback:', currentUser);
      setProfile({
        employee_code: currentUser?.username || currentUser?.employee_code || 'NV001',
        full_name: currentUser?.full_name || 'Quản trị viên',
        role: currentUser?.role || 'admin',
        user_type: currentUser?.user_type || 'admin',
        viettel_email: `${currentUser?.username || 'admin'}@viettel.com.vn`,
        phone: '0987654321',
        position: currentUser?.role === 'admin' ? 'Quản trị hệ thống' : 'Cán bộ nhân sự',
        project: 'Hệ thống QLNV Viettel',
      });
      setEditForm({
        full_name: currentUser?.full_name || 'Quản trị viên',
        viettel_email: `${currentUser?.username || 'admin'}@viettel.com.vn`,
        phone: '0987654321',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchGoogleStatus = async () => {
    try {
      const res = await axios.get('/auth/google/status');
      setGoogleStatus(res.data || { connected: false, email: '', client_id: '', client_secret: '' });
      if (res.data?.client_id) setClientIdInput(res.data.client_id);
      if (res.data?.client_secret) setClientSecretInput(res.data.client_secret);
    } catch (e) {}
  };

  // Upload .json file
  const handleJsonFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setJsonTextInput(event.target.result);
    };
    reader.readAsText(file);
  };

  // Save JSON to .env
  const handleSaveJsonToEnv = async (e) => {
    e.preventDefault();
    if (!jsonTextInput.trim()) {
      alert('Vui lòng dán nội dung JSON hoặc chọn file .json!');
      return;
    }
    setEnvSaveLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/admin/config/env-json', {
        json_text: jsonTextInput.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setConfigSuccess(res.data?.message || '✓ Đã lưu cấu hình JSON vào file .env thành công!');
      setTimeout(() => setConfigSuccess(''), 5000);
      fetchGoogleStatus();
    } catch (err) {
      alert('Lỗi lưu .env: ' + (err.response?.data?.detail || err.message));
    } finally {
      setEnvSaveLoading(false);
    }
  };

  const handleGoogleConnect = async () => {
    setGoogleLoading(true);
    try {
      const res = await axios.get('/auth/google/login');
      if (res.data?.auth_url) {
        window.location.href = res.data.auth_url;
      }
    } catch (err) {
      alert('Không thể mở trang Đăng nhập Google: ' + (err.response?.data?.detail || err.message));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy kết nối tài khoản Google?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post('/auth/google/disconnect', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGoogleStatus({ connected: false, email: '', client_id: '', client_secret: '' });
      alert('Đã hủy kết nối Google OAuth2.');
    } catch (err) {
      alert('Lỗi hủy kết nối: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setInfoMsg({ text: '', type: '' });
    setInfoLoading(true);
    try {
      const res = await axios.put('/users/me', editForm);
      setInfoMsg({ text: 'Cập nhật thông tin thành công và đã đồng bộ CSDL!', type: 'success' });
      setProfile(res.data);
      if (onProfileUpdated) onProfileUpdated(res.data);
    } catch (err) {
      setInfoMsg({ text: err.response?.data?.detail || 'Lỗi khi cập nhật thông tin.', type: 'error' });
    } finally {
      setInfoLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassMsg({ text: '', type: '' });

    if (newPassword !== confirmPassword) {
      setPassMsg({ text: 'Mật khẩu mới và xác nhận mật khẩu không khớp nhau!', type: 'error' });
      return;
    }
    if (newPassword.length < 6) {
      setPassMsg({ text: 'Mật khẩu mới phải có tối thiểu 6 ký tự!', type: 'error' });
      return;
    }

    setPassLoading(true);
    try {
      await axios.post('/auth/change-password', {
        old_password: oldPassword,
        new_password: newPassword,
      });
      setPassMsg({ text: 'Đổi mật khẩu thành công! Hãy lưu nhớ mật khẩu mới.', type: 'success' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      let errorText = 'Mật khẩu hiện tại không chính xác!';
      if (err.response?.data?.detail) {
        errorText = typeof err.response.data.detail === 'string' 
          ? err.response.data.detail 
          : err.response.data.detail[0]?.msg || errorText;
      }
      setPassMsg({ text: errorText, type: 'error' });
    } finally {
      setPassLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.5)',
      backdropFilter: 'blur(4px)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20
    }}>
      <div className="vt-card animate-fade-in" style={{
        width: '100%',
        maxWidth: 600,
        background: '#FFFFFF',
        borderRadius: 16,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        padding: 0
      }}>
        {/* Modal Header */}
        <div style={{
          background: 'linear-gradient(135deg, #EE0033 0%, #D6002D 100%)',
          color: 'white',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'white', color: '#EE0033',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: '1.2rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
              {(profile?.full_name || currentUser?.full_name || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'white' }}>
                {profile?.full_name || currentUser?.full_name || 'Hồ sơ người dùng'}
              </h3>
              <p style={{ fontSize: '0.8rem', opacity: 0.9, margin: 0 }}>
                Mã: <strong>{profile?.employee_code || currentUser?.username || '—'}</strong> | Quyền: <strong>{profile?.role === 'admin' ? 'Quản trị viên (Admin)' : profile?.user_type === 'employee' ? 'Nhân viên' : 'Thực tập sinh'}</strong>
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.8 }}>
            <X size={22} />
          </button>
        </div>

        {/* Modal Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--vt-border)', background: '#F8FAFC' }}>
          <button 
            style={{
              flex: 1, padding: '12px 12px', border: 'none', background: 'transparent',
              fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
              color: activeTab === 'info' ? '#EE0033' : '#64748B',
              borderBottom: activeTab === 'info' ? '2px solid #EE0033' : '2px solid transparent'
            }}
            onClick={() => setActiveTab('info')}
          >
            <User size={15} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
            Thông tin cá nhân
          </button>

          <button 
            style={{
              flex: 1, padding: '12px 12px', border: 'none', background: 'transparent',
              fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
              color: activeTab === 'password' ? '#EE0033' : '#64748B',
              borderBottom: activeTab === 'password' ? '2px solid #EE0033' : '2px solid transparent'
            }}
            onClick={() => setActiveTab('password')}
          >
            <Lock size={15} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
            Đổi mật khẩu
          </button>

          {isAdmin && (
            <button 
              style={{
                flex: 1, padding: '12px 12px', border: 'none', background: 'transparent',
                fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                color: activeTab === 'google' ? '#EE0033' : '#64748B',
                borderBottom: activeTab === 'google' ? '2px solid #EE0033' : '2px solid transparent'
              }}
              onClick={() => setActiveTab('google')}
            >
              <Globe size={15} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
              Cấu Hình JSON & .env
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div style={{ padding: 24, maxHeight: '70vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#EE0033' }}>Đang nạp thông tin từ CSDL...</div>
          ) : activeTab === 'info' ? (
            <form onSubmit={handleUpdateProfile}>
              {infoMsg.text && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 16,
                  background: infoMsg.type === 'success' ? '#DCFCE7' : '#FEE2E2',
                  color: infoMsg.type === 'success' ? '#15803D' : '#B91C1C',
                  display: 'flex', alignItems: 'center', gap: 8
                }}>
                  {infoMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                  <span>{infoMsg.text}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>Mã định danh</label>
                  <input type="text" className="vt-search-input" style={{ width: '100%', background: '#F1F5F9' }} value={profile?.employee_code || ''} readOnly />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>Loại tài khoản</label>
                  <input type="text" className="vt-search-input" style={{ width: '100%', background: '#F1F5F9' }} value={profile?.user_type === 'admin' || profile?.role === 'admin' ? 'Admin Quản trị' : profile?.user_type === 'employee' ? 'Nhân viên Chức năng' : 'Thực tập sinh'} readOnly />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>Họ và tên (*)</label>
                  <input 
                    type="text" className="vt-search-input" style={{ width: '100%' }} 
                    value={editForm.full_name || ''} 
                    onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} 
                    required 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>Email Viettel</label>
                  <input 
                    type="email" className="vt-search-input" style={{ width: '100%' }} 
                    value={editForm.viettel_email || ''} 
                    onChange={e => setEditForm({ ...editForm, viettel_email: e.target.value })} 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>Số điện thoại</label>
                  <input 
                    type="text" className="vt-search-input" style={{ width: '100%' }} 
                    value={editForm.phone || ''} 
                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })} 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--vt-border)' }}>
                <button type="submit" className="vt-btn-primary" disabled={infoLoading}>
                  <Save size={16} />
                  <span>{infoLoading ? 'Đang lưu CSDL...' : 'Lưu thông tin'}</span>
                </button>
              </div>
            </form>
          ) : activeTab === 'password' ? (
            <form onSubmit={handleChangePassword}>
              {passMsg.text && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 16,
                  background: passMsg.type === 'success' ? '#DCFCE7' : '#FEE2E2',
                  color: passMsg.type === 'success' ? '#15803D' : '#B91C1C',
                  display: 'flex', items: 'center', gap: 8
                }}>
                  {passMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                  <span>{passMsg.text}</span>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>Mật khẩu hiện tại (*)</label>
                  <input 
                    type="password" className="vt-search-input" style={{ width: '100%' }} 
                    placeholder="Nhập mật khẩu đang sử dụng" 
                    value={oldPassword} 
                    onChange={e => setOldPassword(e.target.value)} 
                    required 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>Mật khẩu mới (*)</label>
                  <input 
                    type="password" className="vt-search-input" style={{ width: '100%' }} 
                    placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)" 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    required 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>Xác nhận mật khẩu mới (*)</label>
                  <input 
                    type="password" className="vt-search-input" style={{ width: '100%' }} 
                    placeholder="Nhập lại mật khẩu mới" 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--vt-border)' }}>
                <button type="submit" className="vt-btn-primary" disabled={passLoading}>
                  <Key size={16} />
                  <span>{passLoading ? 'Đang đồng bộ CSDL...' : 'Cập nhật Mật khẩu'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {configSuccess && (
                <div style={{ background: '#DCFCE7', color: '#15803D', padding: '10px 14px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle size={16} />
                  <span>{configSuccess}</span>
                </div>
              )}

              {/* Google OAuth Login Status */}
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#DBEAFE', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px auto' }}>
                  <Globe size={20} />
                </div>

                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1E3A8A', margin: '0 0 4px 0' }}>
                  Đăng Nhập Kết Nối Google OAuth2
                </h3>

                {googleStatus.connected ? (
                  <div style={{ background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 8, padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#15803D', fontSize: '0.82rem', fontWeight: 600 }}>
                      <CheckCircle size={16} />
                      <span>Đã kết nối: {googleStatus.email || 'Google Admin Account'}</span>
                    </div>

                    <button 
                      type="button" 
                      onClick={handleGoogleDisconnect}
                      style={{ background: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5', borderRadius: 6, padding: '3px 8px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                    >
                      <Trash2 size={12} />
                      <span>Hủy kết nối</span>
                    </button>
                  </div>
                ) : (
                  <button 
                    type="button" 
                    className="vt-btn-primary" 
                    style={{ background: '#4285F4', margin: '8px auto 0 auto', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                    onClick={handleGoogleConnect}
                    disabled={googleLoading}
                  >
                    <LogIn size={16} />
                    <span>{googleLoading ? 'Đang mở Google...' : 'Đăng Nhập Bằng Google (OAuth2)'}</span>
                  </button>
                )}
              </div>

              {/* Form Input / Upload JSON to .env */}
              <form onSubmit={handleSaveJsonToEnv} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Code size={16} color="#2563EB" />
                    <span>Nhập JSON Cấu Hình ➔ Tự Động Lưu Vào File .env:</span>
                  </h4>

                  <button 
                    type="button"
                    style={{ background: '#EFF6FF', border: '1px solid #93C5FD', color: '#1D4ED8', padding: '4px 10px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={() => jsonFileInputRef.current?.click()}
                  >
                    <Upload size={13} />
                    <span>Chọn File JSON (.json)</span>
                  </button>

                  <input 
                    type="file" 
                    ref={jsonFileInputRef} 
                    accept=".json" 
                    style={{ display: 'none' }} 
                    onChange={handleJsonFileUpload} 
                  />
                </div>

                <div>
                  <textarea 
                    className="vt-search-input" 
                    style={{ width: '100%', height: 110, fontFamily: 'monospace', fontSize: '0.78rem', padding: 10, background: '#FFFFFF', resize: 'vertical' }}
                    placeholder='Dán nội dung file JSON Google OAuth hoặc Service Account tại đây (ví dụ: {"web": {"client_id": "...", "client_secret": "..."}})...'
                    value={jsonTextInput}
                    onChange={e => setJsonTextInput(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    💡 Hệ thống tự phân tích và chuyển sang biến <code>.env</code> chuẩn.
                  </span>

                  <button type="submit" className="vt-btn-primary" style={{ padding: '8px 16px', fontSize: '0.82rem' }} disabled={envSaveLoading}>
                    <Save size={15} />
                    <span>{envSaveLoading ? 'Đang lưu file .env...' : 'Lưu Vào File .env'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Modal Footer with Logout Button */}
        <div style={{
          padding: '14px 24px', background: '#F8FAFC',
          borderTop: '1px solid var(--vt-border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <button 
            type="button" 
            onClick={() => { onClose(); if (onLogout) onLogout(); }} 
            style={{
              border: '1px solid #FEE2E2', background: '#FEF2F2', color: '#DC2626',
              padding: '8px 16px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer'
            }}
          >
            <LogOut size={16} />
            <span>Đăng xuất hệ thống</span>
          </button>

          <button 
            type="button" 
            className="vt-select-sm" 
            style={{ padding: '8px 20px', cursor: 'pointer' }}
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
