import React from 'react';
import { Calendar, UserCheck } from 'lucide-react';

export default function AttendanceTable({ todayWorkers }) {
  // Fallback demo data matching the reference screenshot if todayWorkers is empty
  const defaultWorkers = [
    { code: 'TTS001', name: 'Nguyễn Văn An', dept: 'Công nghệ thông tin', pos: 'Thực tập sinh', time: '08:00 - 17:00', status: 'Đang làm' },
    { code: 'TTS002', name: 'Trần Thị Bình', dept: 'Kế toán', pos: 'Thực tập sinh', time: '08:00 - 17:00', status: 'Đang làm' },
    { code: 'TTS003', name: 'Phạm Văn Cường', dept: 'Kinh doanh', pos: 'Thực tập sinh', time: '08:00 - 17:00', status: 'Đang làm' },
    { code: 'TTS004', name: 'Lê Thị Dung', dept: 'Nhân sự', pos: 'Thực tập sinh', time: '08:00 - 17:00', status: 'Đang làm' },
  ];

  const workers = (todayWorkers && todayWorkers.length > 0)
    ? todayWorkers.map((w, idx) => ({
        code: w.employee_code || `TTS00${idx + 1}`,
        name: w.full_name,
        dept: 'Công nghệ thông tin',
        pos: 'Thực tập sinh',
        time: w.shift === 'S' ? '08:00 - 12:00' : w.shift === 'C' ? '13:00 - 17:00' : '08:00 - 17:00',
        status: 'Đang làm'
      }))
    : defaultWorkers;

  return (
    <div className="vt-card vt-table-card animate-fade-in">
      <div className="vt-card-title-bar">
        <div className="vt-card-title">
          <UserCheck size={18} className="vt-card-title-icon" />
          TTS đi làm hôm nay
        </div>
        <button className="vt-link-btn">Xem tất cả</button>
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
            {workers.map((row, idx) => (
              <tr key={idx}>
                <td style={{ fontWeight: 600, color: '#64748B' }}>{row.code}</td>
                <td style={{ fontWeight: 600, color: '#0F172A' }}>{row.name}</td>
                <td>{row.dept}</td>
                <td>{row.pos}</td>
                <td style={{ color: '#64748B' }}>{row.time}</td>
                <td>
                  <span className="vt-badge vt-badge-success">
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
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
