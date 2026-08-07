import React, { useState } from 'react';
import ProfileModal from './ProfileModal';

export default function HeaderNav({ activeTab, setActiveTab, user, onLogout, onProfileUpdated }) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isEmployee = user?.user_type === 'employee';
  const isIntern = !isAdmin && !isEmployee;

  // Determine active main section
  const getMainSection = (tab) => {
    if (['employees', 'accounts', 'overtime'].includes(tab)) return 'employees';
    if (['interns', 'schedule'].includes(tab)) return 'interns';
    if (['hrai-chat', 'hrai-sheets', 'hrai-db'].includes(tab)) return 'ai';
    return tab;
  };

  const mainActive = getMainSection(activeTab);

  const handleNavClick = (section) => {
    if (section === 'dashboard') setActiveTab('dashboard');
    else if (section === 'employees') setActiveTab('employees');
    else if (section === 'interns') setActiveTab('interns');
    else if (section === 'ai') setActiveTab('hrai-chat');
    else if (section === 'schedule') setActiveTab('schedule');
    else if (section === 'overtime') setActiveTab('overtime');
    else setActiveTab(section);
  };

  return (
    <>
      <header className="vt-header">
        <div className="vt-header-container">
          {/* Left: Viettel Software Logo */}
          <div className="vt-logo-wrap" onClick={() => handleNavClick(isAdmin ? 'dashboard' : 'schedule')}>
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

          {/* Center: Sleek Top Navigation Bar */}
          <nav className="vt-nav-links">
            {isAdmin && (
              <>
                <button 
                  className={`vt-nav-item ${mainActive === 'dashboard' ? 'active' : ''}`}
                  onClick={() => handleNavClick('dashboard')}
                >
                  <span>Dashboard</span>
                </button>

                <button 
                  className={`vt-nav-item ${mainActive === 'employees' ? 'active' : ''}`}
                  onClick={() => handleNavClick('employees')}
                >
                  <span>Nhân sự</span>
                </button>

                <button 
                  className={`vt-nav-item ${mainActive === 'interns' ? 'active' : ''}`}
                  onClick={() => handleNavClick('interns')}
                >
                  <span>Thực tập sinh</span>
                </button>

                <button 
                  className={`vt-nav-item ${mainActive === 'ai' ? 'active' : ''}`}
                  onClick={() => handleNavClick('ai')}
                >
                  <span>AI HR</span>
                </button>
              </>
            )}

            {isEmployee && (
              <>
                <button 
                  className={`vt-nav-item ${mainActive === 'employees' ? 'active' : ''}`}
                  onClick={() => handleNavClick('employees')}
                >
                  <span>Quản lý Nhân sự</span>
                </button>
                <button 
                  className={`vt-nav-item ${mainActive === 'overtime' ? 'active' : ''}`}
                  onClick={() => handleNavClick('overtime')}
                >
                  <span>Chấm công OT</span>
                </button>
                <button 
                  className={`vt-nav-item ${mainActive === 'schedule' ? 'active' : ''}`}
                  onClick={() => handleNavClick('schedule')}
                >
                  <span>Bảng lịch làm việc</span>
                </button>
                <button 
                  className={`vt-nav-item ${mainActive === 'ai' ? 'active' : ''}`}
                  onClick={() => handleNavClick('ai')}
                >
                  <span>Trợ lý AI HR</span>
                </button>
              </>
            )}

            {isIntern && (
              <>
                <button 
                  className={`vt-nav-item ${mainActive === 'schedule' ? 'active' : ''}`}
                  onClick={() => handleNavClick('schedule')}
                >
                  <span>Đăng ký lịch thực tập</span>
                </button>
                <button 
                  className={`vt-nav-item ${mainActive === 'overtime' ? 'active' : ''}`}
                  onClick={() => handleNavClick('overtime')}
                >
                  <span>Chấm công OT</span>
                </button>
              </>
            )}
          </nav>

          {/* Right: Direct Profile Click (No Dropdown Popover!) */}
          <div className="vt-header-actions">
            <div className="vt-user-profile-wrap">
              <div 
                className="vt-user-profile"
                onClick={() => setIsProfileOpen(true)}
                title="Bấm để mở Thông tin cá nhân, Đổi mật khẩu, Cấu hình Google Sheet & Đăng xuất"
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
          </div>
        </div>
      </header>

      {/* Profile & Change Password & Google Sheet Config & Logout Modal */}
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
