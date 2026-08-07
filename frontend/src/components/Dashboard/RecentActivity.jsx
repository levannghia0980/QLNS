import React from 'react';
import { Activity, UserPlus, FileEdit, CheckCircle, FileText, Briefcase, ArrowRight } from 'lucide-react';

export default function RecentActivity() {
  const activities = [
    {
      id: 1,
      title: 'Thêm nhân viên mới',
      desc: 'Nguyễn Văn A - Phòng CNTT',
      time: '2 giờ trước',
      icon: UserPlus,
      bg: '#EFF6FF',
      color: '#2563EB',
    },
    {
      id: 2,
      title: 'Cập nhật hồ sơ',
      desc: 'Trần Thị B - Phòng Kế toán',
      time: '4 giờ trước',
      icon: FileEdit,
      bg: '#FFF0F3',
      color: '#EE0033',
    },
    {
      id: 3,
      title: 'TTS hoàn thành khảo sát',
      desc: 'Phạm Văn C - Thực tập sinh',
      time: '6 giờ trước',
      icon: CheckCircle,
      bg: '#ECFDF5',
      color: '#059669',
    },
    {
      id: 4,
      title: 'Xuất báo cáo nhân sự',
      desc: 'Báo cáo tháng 8/2026',
      time: '8 giờ trước',
      icon: FileText,
      bg: '#FFFBEB',
      color: '#D97706',
    },
    {
      id: 5,
      title: 'Thêm loại nhân viên',
      desc: 'Chuyên gia - Onsite',
      time: '10 giờ trước',
      icon: Briefcase,
      bg: '#F3E8FF',
      color: '#9333EA',
    },
  ];

  return (
    <div className="vt-card animate-fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="vt-card-title-bar">
        <div className="vt-card-title">
          <Activity size={18} className="vt-card-title-icon" />
          Hoạt động gần đây
        </div>
      </div>

      <div className="vt-activity-list" style={{ flexGrow: 1 }}>
        {activities.map((act) => {
          const Icon = act.icon;
          return (
            <div key={act.id} className="vt-activity-item">
              <div className="vt-activity-icon" style={{ background: act.bg, color: act.color }}>
                <Icon size={16} />
              </div>
              <div className="vt-activity-content">
                <div className="vt-activity-title">{act.title}</div>
                <div className="vt-activity-desc">{act.desc}</div>
              </div>
              <span className="vt-activity-time">{act.time}</span>
            </div>
          );
        })}
      </div>

      <button className="vt-see-all-btn">
        <span>Xem tất cả</span>
        <ArrowRight size={14} />
      </button>

      <style>{`
        .vt-see-all-btn {
          margin-top: 16px;
          padding-top: 12px;
          border: none;
          border-top: 1px solid var(--vt-border);
          background: transparent;
          color: var(--vt-text-muted);
          font-size: 0.825rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          cursor: pointer;
          width: 100%;
          transition: color 0.15s ease;
        }
        .vt-see-all-btn:hover {
          color: var(--vt-red);
        }
      `}</style>
    </div>
  );
}
