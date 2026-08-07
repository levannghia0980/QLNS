import React from 'react';
import { Calendar, UserCheck } from 'lucide-react';

export default function AttendanceTable({ todayWorkers }) {
  const workers = Array.isArray(todayWorkers) ? todayWorkers : [];

  return (
    <div className="vt-card vt-table-card animate-fade-in">
      <div className="vt-card-title-bar">
        <div className="vt-card-title">
          <UserCheck size={18} className="vt-card-title-icon" />
          TTS đi làm hôm nay ({workers.length})
        </div>
        <span style={{ fontSize: '0.8rem', color: '#64748B', fontStyle: 'italic' }}>
          Dữ liệu thời gian thực theo lịch làm việc CSDL
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="vt-table">
          <thead>
            <tr>
              <th>MÃ NV</th>
              <th>HỌ VÀ TÊN</th>
              <th>PHÒNG BAN</th>
              <th>VỊ TRÍ</th>
              <th>THỜI GIAN</th>
              <th>TRẠNG THÁI</th>
            </tr>
          </thead>
          <tbody>
            {workers.length > 0 ? (
              workers.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 700, color: '#EE0033' }}>{row.employee_code}</td>
                  <td style={{ fontWeight: 600, color: '#0F172A' }}>{row.full_name}</td>
                  <td>{row.department || 'Công nghệ thông tin'}</td>
                  <td>{row.position || 'Thực tập sinh'}</td>
                  <td style={{ color: '#64748B' }}>{row.time}</td>
                  <td>
                    <span className="vt-badge vt-badge-success">
                      {row.status || 'Đang làm'}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 28, color: '#64748B' }}>
                  Hôm nay là cuối tuần (hoặc không có ca đăng ký), không có lịch làm việc của TTS hôm nay.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .vt-link-btn {
          background: transparent;
          border: none;
          color: var(--vt-text-muted);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
        }
        .vt-link-btn:hover {
          color: var(--vt-red);
        }
      `}</style>
    </div>
  );
}
