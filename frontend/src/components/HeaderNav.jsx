import React, { useState } from 'react';
import ProfileModal from './ProfileModal';

export default function HeaderNav({ activeTab, setActiveTab, user, onLogout, onProfileUpdated }) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isEmployee = user?.user_type === 'employee';
  const isIntern = !isAdmin && !isEmployee;

  const handleNavClick = (section) => {
    setActiveTab(section);
  };

  return (
    <>
      <header className="vt-header">
        <div className="vt-header-container">
          {/* Left: Viettel Software Logo */}
          <div 
            className="vt-logo-wrap" 
            onClick={() => handleNavClick(isAdmin ? 'dashboard' : isEmployee ? 'overtime' : 'schedule')}
          >
            <img 
              src="/static/images/logo-1-2x-1.png" 
              alt="Viettel Software" 
              className="vt-logo-img"
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
              }}
            />
            <div className="vt-logo-text" style={{ display: 'none' }}>
              <span>viettel</span>
              <span className="vt-logo-sub">software</span>
            </div>
          </div>

          {/* Center: Top Navigation Bar */}
          <nav className="vt-nav-links">
            {/* Admin Tabs */}
            {isAdmin && (
              <>
                <button 
                  className={`vt-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                  onClick={() => handleNavClick('dashboard')}
                >
                  <span>Dashboard</span>
                </button>

                <button 
                  className={`vt-nav-item ${activeTab === 'employees' ? 'active' : ''}`}
                  onClick={() => handleNavClick('employees')}
                >
                  <span>Nhân sự</span>
                </button>

                <button 
                  className={`vt-nav-item ${activeTab === 'interns' ? 'active' : ''}`}
                  onClick={() => handleNavClick('interns')}
                >
                  <span>Thực tập sinh</span>
                </button>

                <button 
                  className={`vt-nav-item ${['hrai-chat', 'hrai-sheets', 'hrai-db', 'ai'].includes(activeTab) ? 'active' : ''}`}
                  onClick={() => handleNavClick('hrai-chat')}
                >
                  <span>AI HR</span>
                </button>
              </>
            )}

            {/* Employee Tabs: Strictly Profile and Overtime */}
            {isEmployee && (
              <>
                <button 
                  className={`vt-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
                  onClick={() => handleNavClick('profile')}
                >
                  <span>Hồ sơ cá nhân</span>
                </button>

                <button 
                  className={`vt-nav-item ${activeTab === 'overtime' ? 'active' : ''}`}
                  onClick={() => handleNavClick('overtime')}
                >
                  <span>Chấm công OT</span>
                </button>
              </>
            )}

            {/* Intern Tabs */}
            {isIntern && (
              <>
                <button 
                  className={`vt-nav-item ${activeTab === 'schedule' ? 'active' : ''}`}
                  onClick={() => handleNavClick('schedule')}
                >
                  <span>Đăng ký lịch thực tập</span>
                </button>
                <button 
                  className={`vt-nav-item ${activeTab === 'overtime' ? 'active' : ''}`}
                  onClick={() => handleNavClick('overtime')}
                >
                  <span>Chấm công OT</span>
                </button>
              </>
            )}
          </nav>

          {/* Right: Direct Profile / User avatar */}
          <div className="vt-header-actions">
            <div className="vt-user-profile-wrap">
              <div 
                className="vt-user-profile"
                onClick={() => {
                  if (isEmployee) {
                    setActiveTab('profile');
                  } else {
                    setIsProfileOpen(true);
                  }
                }}
                title={isEmployee ? "Xem & sửa Hồ sơ cá nhân" : "Bấm để mở Cài đặt tài khoản & Đăng xuất"}
                style={{ cursor: 'pointer' }}
              >
                <div className="vt-avatar">
                  {(user?.full_name || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="vt-user-info">
                  <span className="vt-user-name">{user?.full_name || 'Người dùng'}</span>
                  <span className="vt-user-role">
                    {isAdmin ? 'Quản trị viên (Admin)' : isEmployee ? 'Nhân viên' : 'Thực tập sinh'}
                  </span>
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <button 
              onClick={onLogout}
              className="vt-btn-outline-sm"
              style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: 8, cursor: 'pointer', border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#64748B', fontWeight: 600 }}
              title="Đăng xuất khỏi hệ thống"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      {/* Profile Modal (For Password / Google Config / Details) */}
      <ProfileModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
        currentUser={user}
        onLogout={onLogout}
        onProfileUpdated={onProfileUpdated}
      />
    </>
  );
}
