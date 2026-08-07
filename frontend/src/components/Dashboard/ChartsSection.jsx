import React from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { PieChart as PieIcon, BarChart2, AlignLeft } from 'lucide-react';

export default function ChartsSection({ stats }) {
  const empCount = stats?.total_employees ?? 0;
  const ttsCount = stats?.total_interns ?? 0;
  const totalCount = empCount + ttsCount;

  const empPercent = totalCount > 0 ? ((empCount / totalCount) * 100).toFixed(1) + '%' : '0%';
  const ttsPercent = totalCount > 0 ? ((ttsCount / totalCount) * 100).toFixed(1) + '%' : '0%';

  const donutData = [
    { name: 'Nhân viên', value: empCount, percentage: empPercent, color: '#6366F1' },
    { name: 'Thực tập sinh', value: ttsCount, percentage: ttsPercent, color: '#06B6D4' },
  ];

  const empBarData = [
    { name: 'NS Trung tâm', value: stats?.emp_trung_tam ?? 0, color: '#6366F1' },
    { name: 'Cho mượn', value: stats?.emp_cho_muon ?? 0, color: '#EC4899' },
    { name: 'Onsite', value: stats?.emp_onsite ?? 0, color: '#8B5CF6' },
  ];

  const ttsBarData = [
    { name: 'Thực tập', value: stats?.intern_count ?? 0, color: '#10B981' },
    { name: 'Đi mượn', value: stats?.borrowed_count ?? 0, color: '#F59E0B' },
  ];

  return (
    <div className="vt-charts-row animate-fade-in">
      {/* 1. Donut Chart */}
      <div className="vt-card">
        <div className="vt-card-title-bar">
          <div className="vt-card-title">
            <PieIcon size={18} className="vt-card-title-icon" />
            Cơ cấu nhân sự
          </div>
          <select className="vt-select-sm" defaultValue="8/2026">
            <option value="8/2026">Tháng 8/2026</option>
            <option value="7/2026">Tháng 7/2026</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="vt-donut-wrap" style={{ width: 160, height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                  animationDuration={800}
                >
                  {donutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="vt-donut-center">
              <div className="vt-donut-total">{totalCount}</div>
              <div className="vt-donut-sub">Tổng</div>
            </div>
          </div>

          <div className="vt-legend-list" style={{ flexGrow: 1 }}>
            {donutData.map((item, idx) => (
              <div key={idx} className="vt-legend-item">
                <div className="vt-legend-label">
                  <span className="vt-legend-dot" style={{ background: item.color }} />
                  <span>{item.name}</span>
                </div>
                <div className="vt-legend-val">
                  {item.value} ({item.percentage})
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Vertical Bar Chart */}
      <div className="vt-card">
        <div className="vt-card-title-bar">
          <div className="vt-card-title">
            <BarChart2 size={18} className="vt-card-title-icon" />
            Phân loại nhân viên
          </div>
          <select className="vt-select-sm" defaultValue="8/2026">
            <option value="8/2026">Tháng 8/2026</option>
            <option value="7/2026">Tháng 7/2026</option>
          </select>
        </div>

        <div style={{ height: 210 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={empBarData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                contentStyle={{ background: '#FFFFFF', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={36} animationDuration={800}>
                {empBarData.map((entry, index) => (
                  <Cell key={`bar-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Horizontal Bar Chart */}
      <div className="vt-card">
        <div className="vt-card-title-bar">
          <div className="vt-card-title">
            <AlignLeft size={18} className="vt-card-title-icon" />
            Phân loại thực tập sinh
          </div>
          <select className="vt-select-sm" defaultValue="8/2026">
            <option value="8/2026">Tháng 8/2026</option>
            <option value="7/2026">Tháng 7/2026</option>
          </select>
        </div>

        <div style={{ height: 210 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={ttsBarData} margin={{ top: 20, right: 20, left: 10, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                contentStyle={{ background: '#FFFFFF', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={26} animationDuration={800}>
                {ttsBarData.map((entry, index) => (
                  <Cell key={`hbar-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
