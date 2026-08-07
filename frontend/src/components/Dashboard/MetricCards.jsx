import React from 'react';
import { Users, Briefcase, GraduationCap, UserCheck } from 'lucide-react';

export default function MetricCards({ stats }) {
  const totalEmployees = stats?.total_employees ?? 0;
  const totalInterns = stats?.total_interns ?? 0;
  const totalPersonnel = totalEmployees + totalInterns;

  const empChoMuon = stats?.emp_cho_muon ?? 0;
  const empOnsite = stats?.emp_onsite ?? 0;
  const borrowedCount = stats?.borrowed_count ?? 0;
  const internCount = stats?.intern_count ?? 0;
  const workingCount = stats?.working ?? 0;
  const resignedCount = stats?.resigned ?? 0;

  const cardItems = [
    {
      title: 'TỔNG NHÂN SỰ',
      value: totalPersonnel,
      subText: `${totalEmployees} Nhân viên | ${totalInterns} TTS`,
      icon: Users,
      iconBg: '#FFE5E9',
      iconColor: '#EE0033',
    },
    {
      title: 'LOẠI NHÂN VIÊN',
      value: totalEmployees,
      subText: `${empChoMuon} Cho mượn | ${empOnsite} Onsite`,
      icon: Briefcase,
      iconBg: '#EFF6FF',
      iconColor: '#2563EB',
    },
    {
      title: 'NGUỒN TTS',
      value: totalInterns,
      subText: `${borrowedCount} Đi mượn | ${internCount} Thực tập`,
      icon: GraduationCap,
      iconBg: '#ECFDF5',
      iconColor: '#059669',
    },
    {
      title: 'TTS ĐANG LÀM',
      value: workingCount,
      subText: `${resignedCount} đã nghỉ`,
      icon: UserCheck,
      iconBg: '#FFFBEB',
      iconColor: '#D97706',
    },
  ];

  return (
    <div className="vt-metrics-grid animate-fade-in">
      {cardItems.map((item, index) => {
        const IconComponent = item.icon;
        return (
          <div key={index} className="vt-card vt-metric-card" style={{ padding: '20px 24px' }}>
            <div style={{ flexGrow: 1 }}>
              <div className="vt-metric-header" style={{ marginBottom: 12 }}>
                <div className="vt-metric-icon" style={{ background: item.iconBg, color: item.iconColor }}>
                  <IconComponent size={20} />
                </div>
                <span className="vt-metric-label" style={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>
                  {item.title}
                </span>
              </div>
              <div className="vt-metric-val" style={{ fontSize: '2.2rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.1, marginBottom: 8 }}>
                {item.value.toLocaleString()}
              </div>
              <div className="vt-metric-sub" style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 500 }}>
                {item.subText}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
