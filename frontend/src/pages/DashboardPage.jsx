import React, { useEffect, useState } from 'react';
import { Download, Calendar, Clock, ChevronDown } from 'lucide-react';
import MetricCards from '../components/Dashboard/MetricCards';
import ChartsSection from '../components/Dashboard/ChartsSection';
import AttendanceTable from '../components/Dashboard/AttendanceTable';
import NotificationsWidget from '../components/Dashboard/NotificationsWidget';
import axios from 'axios';

export default function DashboardPage({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    // Real-time Clock
    const updateTime = () => {
      const now = new Date();
      const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
      setDateStr(`${days[now.getDay()]}, ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`);
      setTimeStr(now.toTimeString().split(' ')[0]);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);

    // Fetch Stats from Backend API
    fetchStats();

    return () => clearInterval(timer);
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/admin/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(res.data);
    } catch (err) {
      console.warn('Using default demo stats (unauthenticated or backend offline)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="vt-container animate-fade-in">
      {/* Top Header Title & Actions Bar */}
      <div className="vt-page-header">
        <div>
          <h1 className="vt-page-title">Dashboard</h1>
          <p className="vt-page-desc">Tổng quan hệ thống quản trị nhân sự</p>
        </div>

        <div className="vt-page-actions">
          {/* Realtime Date & Clock Badge */}
          <div className="vt-time-badge">
            <Calendar size={15} style={{ color: '#64748B' }} />
            <span>{dateStr || 'Thứ Sáu, 8/8/2026'}</span>
            <span style={{ color: '#CBD5E1' }}>|</span>
            <Clock size={15} style={{ color: '#64748B' }} />
            <span className="vt-time-clock">{timeStr || '11:19:18'}</span>
          </div>

          {/* Export Report Red Button */}
          <button className="vt-btn-primary">
            <Download size={16} />
            <span>Xuất báo cáo</span>
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* 4 Metric Sparkline Cards */}
      <MetricCards stats={stats} />

      {/* Main Charts & Activity Row */}
      <div className="vt-dashboard-main">
        <div>
          <ChartsSection stats={stats} />
          
          {/* Lower Grid: Attendance Table */}
          <AttendanceTable todayWorkers={stats?.today_workers} />
        </div>

        {/* Right Sidebar: OT Notifications Widget */}
        <div>
          <NotificationsWidget onNavigate={onNavigate} />
        </div>
      </div>

      {/* Footer */}
      <footer className="vt-footer">
        © 2026 Viettel Software. All rights reserved.
      </footer>
    </div>
  );
}
