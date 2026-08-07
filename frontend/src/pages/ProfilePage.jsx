import React, { useState, useEffect } from 'react';
import { 
  User, Phone, CreditCard, Mail, MapPin, Calendar, Building, 
  Briefcase, Save, Key, ShieldCheck, CheckCircle2, AlertCircle,
  Eye, EyeOff, UserCheck, Award, Hash, Landmark
} from 'lucide-react';
import axios from 'axios';

export default function ProfilePage({ currentUser, onProfileUpdated }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState([]);

  // Editable Form State
  const [phone, setPhone] = useState('');
  const [cccd, setCccd] = useState('');
  const [gender, setGender] = useState('');
  const [birthday, setBirthday] = useState('');
  const [ethnicity, setEthnicity] = useState('');
  const [hometown, setHometown] = useState('');
  const [viettelEmail, setViettelEmail] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [employmentType, setEmploymentType] = useState('Fulltime');

  // Change Password State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passMsg, setPassMsg] = useState({ text: '', type: '' });

  // Save Info State
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      const [userRes, posRes] = await Promise.all([
        axios.get('/users/me'),
        axios.get('/employees/positions').catch(() => ({ data: [] }))
      ]);

      const data = userRes.data;
      setProfile(data);
      setPositions(posRes.data || []);

      // Populate form fields
      setPhone(data.phone || '');
      setCccd(data.cccd || '');
      setGender(data.gender || '');
      setBirthday(data.birthday || '');
      setEthnicity(data.ethnicity || '');
      setHometown(data.hometown || '');
      setViettelEmail(data.viettel_email || '');
      setBankName(data.bank_name || '');
      setBankAccount(data.bank_account || '');
      setEmploymentType(data.employment_type || 'Fulltime');
    } catch (err) {
      console.warn('Profile fetch error, using local fallback:', err);
      const saved = localStorage.getItem('user');
      if (saved) {
        try {
          const u = JSON.parse(saved);
          setProfile(u);
          setViettelEmail(u.username ? `${u.username}@viettel.com.vn` : '');
        } catch (_) {}
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    setSaveLoading(true);
    setSaveMsg({ text: '', type: '' });

    try {
      const payload = {
        phone: phone.trim() || null,
        cccd: cccd.trim() || null,
        gender: gender || null,
        birthday: birthday || null,
        ethnicity: ethnicity.trim() || null,
        hometown: hometown.trim() || null,
        viettel_email: viettelEmail.trim() || null,
        bank_name: bankName.trim() || null,
        bank_account: bankAccount.trim() || null,
        employment_type: employmentType || 'Fulltime'
      };

      const res = await axios.put('/users/me', payload);
      setProfile(res.data);
      setSaveMsg({ text: 'Cập nhật thông tin hồ sơ cá nhân thành công!', type: 'success' });

      // Update local storage
      const saved = localStorage.getItem('user');
      if (saved) {
        try {
          const u = JSON.parse(saved);
          const updated = { ...u, ...res.data };
          localStorage.setItem('user', JSON.stringify(updated));
        } catch (_) {}
      }

      if (onProfileUpdated) onProfileUpdated(res.data);
      setTimeout(() => setSaveMsg({ text: '', type: '' }), 4000);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Lỗi lưu thông tin';
      setSaveMsg({ text: msg, type: 'error' });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassMsg({ text: '', type: '' });

    if (!oldPassword) {
      setPassMsg({ text: 'Vui lòng nhập mật khẩu hiện tại.', type: 'error' });
      return;
    }
    if (newPassword.length < 6) {
      setPassMsg({ text: 'Mật khẩu mới phải có ít nhất 6 ký tự.', type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassMsg({ text: 'Xác nhận mật khẩu mới không khớp.', type: 'error' });
      return;
    }

    setPassLoading(true);
    try {
      await axios.post('/auth/change-password', {
        old_password: oldPassword,
        new_password: newPassword
      });
      setPassMsg({ text: 'Đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới.', type: 'success' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPassMsg({ text: '', type: '' }), 5000);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Lỗi đổi mật khẩu';
      setPassMsg({ text: msg, type: 'error' });
    } finally {
      setPassLoading(false);
    }
  };

  const getPositionName = () => {
    if (!profile) return '—';
    if (profile.position_rel?.name) return profile.position_rel.name;
    if (profile.position) return profile.position;
    if (profile.position_id && positions.length > 0) {
      const p = positions.find(x => x.id === profile.position_id);
      if (p) return p.name;
    }
    return 'Nhân viên Phần mềm';
  };

  if (loading) {
    return (
      <div className="vt-container animate-fade-in" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: '1rem', color: 'var(--vt-red)', fontWeight: 600 }}>
          Đang nạp thông tin hồ sơ cá nhân...
        </div>
      </div>
    );
  }

  const isEmployee = profile?.user_type === 'employee';
  const initialLetter = (profile?.full_name || 'U').charAt(0).toUpperCase();

  return (
    <div className="vt-container animate-fade-in" style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      
      {/* Header with Title and Save Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            <User size={28} style={{ color: 'var(--vt-red)' }} />
            <span>Hồ sơ cá nhân</span>
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.9rem', marginTop: 4, marginBottom: 0 }}>
            Xem và cập nhật thông tin cá nhân, tài khoản ngân hàng và thông tin công tác Viettel Software
          </p>
        </div>

        <button 
          className="vt-btn-primary" 
          onClick={handleSaveProfile}
          disabled={saveLoading}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', fontSize: '0.95rem' }}
        >
          <Save size={18} />
          <span>{saveLoading ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
        </button>
      </div>

      {/* Status Messages */}
      {saveMsg.text && (
        <div style={{ 
          background: saveMsg.type === 'success' ? '#DCFCE7' : '#FEE2E2', 
          color: saveMsg.type === 'success' ? '#15803D' : '#DC2626', 
          border: `1px solid ${saveMsg.type === 'success' ? '#86EFAC' : '#FCA5A5'}`,
          padding: '12px 16px', borderRadius: 10, fontSize: '0.9rem', fontWeight: 600, 
          marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 
        }}>
          {saveMsg.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span>{saveMsg.text}</span>
        </div>
      )}

      {/* Top Banner Card: Avatar & Summary Info */}
      <div className="vt-card" style={{ padding: 24, marginBottom: 24, background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          
          {/* Avatar Circle */}
          <div style={{ 
            width: 88, 
            height: 88, 
            borderRadius: '50%', 
            background: 'linear-gradient(135deg, #EE0033 0%, #B91C1C 100%)', 
            color: '#FFFFFF', 
            fontSize: '2.5rem', 
            fontWeight: 800, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            boxShadow: '0 8px 24px rgba(238, 0, 51, 0.28)',
            flexShrink: 0
          }}>
            {initialLetter}
          </div>

          {/* User Meta Info */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                {profile?.full_name || 'Nhân viên Viettel'}
              </h2>
              <span style={{ 
                background: '#F1F5F9', 
                color: '#475569', 
                fontFamily: 'monospace', 
                fontWeight: 700, 
                fontSize: '0.88rem', 
                padding: '4px 10px', 
                borderRadius: 6,
                border: '1px solid #CBD5E1'
              }}>
                {profile?.employee_code || 'NV000'}
              </span>
            </div>

            <div style={{ fontSize: '0.9rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
              {profile?.viettel_email && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Mail size={15} style={{ color: '#EE0033' }} />
                  <strong>{profile.viettel_email}</strong>
                </span>
              )}
              {profile?.phone && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Phone size={15} style={{ color: '#2563EB' }} />
                  <span>{profile.phone}</span>
                </span>
              )}
              {profile?.project && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Briefcase size={15} style={{ color: '#059669' }} />
                  <span>Dự án: <strong>{profile.project}</strong></span>
                </span>
              )}
            </div>

            {/* Badges */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ 
                background: 'rgba(37, 99, 235, 0.1)', 
                color: '#1D4ED8', 
                border: '1px solid rgba(37, 99, 235, 0.25)', 
                padding: '4px 12px', 
                borderRadius: 20, 
                fontSize: '0.8rem', 
                fontWeight: 700, 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: 5 
              }}>
                <Briefcase size={13} />
                <span>{isEmployee ? 'Nhân sự chính thức / Thử việc' : 'Thực tập sinh'}</span>
              </span>

              <span style={{ 
                background: profile?.employment_status === 'Chính thức' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)', 
                color: profile?.employment_status === 'Chính thức' ? '#047857' : '#B45309', 
                border: `1px solid ${profile?.employment_status === 'Chính thức' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`, 
                padding: '4px 12px', 
                borderRadius: 20, 
                fontSize: '0.8rem', 
                fontWeight: 700, 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: 5 
              }}>
                <Award size={13} />
                <span>{profile?.employment_status || 'Thử việc'}</span>
              </span>

              <span style={{ 
                background: 'rgba(238, 0, 51, 0.08)', 
                color: '#EE0033', 
                border: '1px solid rgba(238, 0, 51, 0.2)', 
                padding: '4px 12px', 
                borderRadius: 20, 
                fontSize: '0.8rem', 
                fontWeight: 700, 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: 5 
              }}>
                <UserCheck size={13} />
                <span>{getPositionName()}</span>
              </span>

              {profile?.staff_category && (
                <span style={{ 
                  background: '#F8FAFC', 
                  color: '#475569', 
                  border: '1px solid #E2E8F0', 
                  padding: '4px 12px', 
                  borderRadius: 20, 
                  fontSize: '0.8rem', 
                  fontWeight: 600 
                }}>
                  {profile.staff_category}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2-Column Grid of Information Sections */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 24, marginBottom: 24 }}>
        
        {/* Section 1: Thông tin cá nhân (Có thể chỉnh sửa) */}
        <div className="vt-card" style={{ padding: 24, background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 16, borderBottom: '1px solid #F1F5F9', marginBottom: 20 }}>
            <User size={20} style={{ color: '#2563EB' }} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1E293B', margin: 0 }}>
              Thông tin cá nhân <span style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 500 }}>(có thể thay đổi)</span>
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Phone & CCCD */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label className="vt-label">Số điện thoại</label>
                <input 
                  type="text" 
                  className="vt-input" 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)} 
                  placeholder="0987654321..."
                />
              </div>
              <div>
                <label className="vt-label">Số CCCD / CMND</label>
                <input 
                  type="text" 
                  className="vt-input" 
                  value={cccd} 
                  onChange={(e) => setCccd(e.target.value)} 
                  placeholder="012345678901..."
                />
              </div>
            </div>

            {/* Gender & Birthday */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label className="vt-label">Giới tính</label>
                <select 
                  className="vt-input" 
                  value={gender} 
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="">-- Chọn giới tính --</option>
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>
              <div>
                <label className="vt-label">Ngày sinh</label>
                <input 
                  type="date" 
                  className="vt-input" 
                  value={birthday} 
                  onChange={(e) => setBirthday(e.target.value)} 
                />
              </div>
            </div>

            {/* Ethnicity & Hometown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label className="vt-label">Dân tộc</label>
                <input 
                  type="text" 
                  className="vt-input" 
                  value={ethnicity} 
                  onChange={(e) => setEthnicity(e.target.value)} 
                  placeholder="Kinh, Tày, Nùng..."
                />
              </div>
              <div>
                <label className="vt-label">Quê quán</label>
                <input 
                  type="text" 
                  className="vt-input" 
                  value={hometown} 
                  onChange={(e) => setHometown(e.target.value)} 
                  placeholder="Hà Nội, Nam Định..."
                />
              </div>
            </div>

            {/* Viettel Email */}
            <div>
              <label className="vt-label">Email Viettel</label>
              <input 
                type="email" 
                className="vt-input" 
                value={viettelEmail} 
                onChange={(e) => setViettelEmail(e.target.value)} 
                placeholder="tennv@viettel.com.vn"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Tài khoản ngân hàng & Thông tin bổ sung */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Bank Information Card */}
          <div className="vt-card" style={{ padding: 24, background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 16, borderBottom: '1px solid #F1F5F9', marginBottom: 20 }}>
              <Landmark size={20} style={{ color: '#059669' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1E293B', margin: 0 }}>
                Tài khoản ngân hàng & Trợ cấp
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="vt-label">Tên Ngân hàng</label>
                <input 
                  type="text" 
                  className="vt-input" 
                  value={bankName} 
                  onChange={(e) => setBankName(e.target.value)} 
                  placeholder="MB Bank, Vietcombank, BIDV, Viettel Money..."
                />
              </div>

              <div>
                <label className="vt-label">Số tài khoản ngân hàng</label>
                <input 
                  type="text" 
                  className="vt-input" 
                  value={bankAccount} 
                  onChange={(e) => setBankAccount(e.target.value)} 
                  placeholder="0123456789..."
                />
              </div>

              {!isEmployee && (
                <div>
                  <label className="vt-label">Loại hình làm việc</label>
                  <select 
                    className="vt-input" 
                    value={employmentType} 
                    onChange={(e) => setEmploymentType(e.target.value)}
                  >
                    <option value="Fulltime">Fulltime</option>
                    <option value="Parttime">Parttime</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Readonly Work Info Card */}
          <div className="vt-card" style={{ padding: 24, background: '#F8FAFC', borderRadius: 16, border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid #E2E8F0', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Building size={20} style={{ color: '#64748B' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1E293B', margin: 0 }}>
                  Thông tin công tác Viettel
                </h3>
              </div>
              <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 600, background: '#FFFFFF', padding: '3px 8px', borderRadius: 6, border: '1px solid #E2E8F0' }}>
                Chỉ đọc
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: '0.88rem' }}>
              <div>
                <div style={{ color: '#64748B', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Vị trí</div>
                <div style={{ fontWeight: 700, color: '#0F172A' }}>{getPositionName()}</div>
              </div>
              <div>
                <div style={{ color: '#64748B', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Dự án</div>
                <div style={{ fontWeight: 700, color: '#0F172A' }}>{profile?.project || '—'}</div>
              </div>
              <div>
                <div style={{ color: '#64748B', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Quản lý trực tiếp (QLTT)</div>
                <div style={{ fontWeight: 700, color: '#2563EB' }}>{profile?.direct_manager || '—'}</div>
              </div>
              <div>
                <div style={{ color: '#64748B', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Loại nhân sự</div>
                <div style={{ fontWeight: 700, color: '#0F172A' }}>{profile?.staff_category || 'NS trung tâm'}</div>
              </div>
              <div>
                <div style={{ color: '#64748B', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Vị trí ngồi</div>
                <div style={{ fontWeight: 700, color: '#0F172A' }}>{profile?.seat_position || 'Tầng 12 - Tòa Viettel'}</div>
              </div>
              <div>
                <div style={{ color: '#64748B', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Trạng thái tài khoản</div>
                <div style={{ fontWeight: 700, color: '#059669' }}>Đang hoạt động (Active)</div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Section 3: Đổi mật khẩu tài khoản */}
      <div className="vt-card" style={{ padding: 24, background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', maxWidth: 640 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 16, borderBottom: '1px solid #F1F5F9', marginBottom: 20 }}>
          <Key size={20} style={{ color: '#EE0033' }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1E293B', margin: 0 }}>
            Đổi mật khẩu tài khoản
          </h3>
        </div>

        {passMsg.text && (
          <div style={{ 
            background: passMsg.type === 'success' ? '#DCFCE7' : '#FEE2E2', 
            color: passMsg.type === 'success' ? '#15803D' : '#DC2626', 
            border: `1px solid ${passMsg.type === 'success' ? '#86EFAC' : '#FCA5A5'}`,
            padding: '10px 14px', borderRadius: 8, fontSize: '0.88rem', fontWeight: 600, 
            marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 
          }}>
            {passMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{passMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="vt-label">Mật khẩu hiện tại</label>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? 'text' : 'password'} 
                className="vt-input" 
                value={oldPassword} 
                onChange={(e) => setOldPassword(e.target.value)} 
                placeholder="Nhập mật khẩu đang sử dụng..."
                required
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label className="vt-label">Mật khẩu mới</label>
              <input 
                type={showPassword ? 'text' : 'password'} 
                className="vt-input" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                placeholder="Tối thiểu 6 ký tự..."
                required
              />
            </div>
            <div>
              <label className="vt-label">Xác nhận mật khẩu mới</label>
              <input 
                type={showPassword ? 'text' : 'password'} 
                className="vt-input" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                placeholder="Nhập lại mật khẩu mới..."
                required
              />
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <button 
              type="submit" 
              className="vt-btn-primary" 
              disabled={passLoading}
              style={{ background: '#1E293B', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px' }}
            >
              <Key size={16} />
              <span>{passLoading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}</span>
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
