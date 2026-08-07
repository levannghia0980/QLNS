import React, { useState, useEffect } from 'react';
import axios from 'axios';
import HeaderNav from './components/HeaderNav';
import ErrorBoundary from './components/ErrorBoundary';
import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import InternsPage from './pages/InternsPage';
import OvertimePage from './pages/OvertimePage';
import SchedulePage from './pages/SchedulePage';
import ProfilePage from './pages/ProfilePage';
import AiHrPage from './pages/AiHrPage';
import LoginPage from './pages/LoginPage';

// Set base URL for axios
axios.defaults.baseURL = '';

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      try {
        const u = JSON.parse(savedUser);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setUser(u);
        if (u.user_type === 'employee') {
          setActiveTab('overtime');
        } else if (u.user_type === 'intern' && u.role !== 'admin') {
          setActiveTab('schedule');
        } else {
          setActiveTab('dashboard');
        }
      } catch (e) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
      }
    } else {
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (loginData) => {
    const token = loginData.access_token;
    const userData = {
      full_name: loginData.full_name || loginData.username || 'Quản trị viên',
      role: loginData.role || 'admin',
      user_type: loginData.user_type || 'admin',
      user_id: loginData.user_id,
      username: loginData.username
    };

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);

    if (userData.user_type === 'employee') {
      setActiveTab('overtime');
    } else if (userData.user_type === 'intern' && userData.role !== 'admin') {
      setActiveTab('schedule');
    } else {
      setActiveTab('dashboard');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const handleProfileUpdated = (updatedData) => {
    setUser(prev => ({ ...prev, ...updatedData }));
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#F4F6F9' }}>
        <div style={{ fontSize: '1rem', color: '#EE0033', fontWeight: 600 }}>Đang nạp dữ liệu Viettel Software...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--vt-bg)' }}>
      {/* Top Header Navigation */}
      <HeaderNav 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        user={user} 
        onLogout={handleLogout} 
        onProfileUpdated={handleProfileUpdated}
      />

      {/* Main Active Page with Error Boundary */}
      <main style={{ flexGrow: 1 }}>
        <ErrorBoundary key={activeTab}>
          {activeTab === 'dashboard' && <DashboardPage onNavigate={setActiveTab} />}
          {activeTab === 'profile' && <ProfilePage currentUser={user} onProfileUpdated={handleProfileUpdated} />}
          {['employees', 'accounts'].includes(activeTab) && <EmployeesPage />}
          {activeTab === 'interns' && <InternsPage />}
          {activeTab === 'overtime' && <OvertimePage />}
          {activeTab === 'schedule' && <SchedulePage />}
          {['hrai-chat', 'hrai-sheets', 'hrai-db'].includes(activeTab) && <AiHrPage />}
          {['reports', 'settings'].includes(activeTab) && <DashboardPage />}
        </ErrorBoundary>
      </main>
    </div>
  );
}
