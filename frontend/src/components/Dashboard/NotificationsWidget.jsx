import React, { useState, useEffect } from 'react';
import { Bell, Clock, ChevronRight, CheckCircle2, XCircle, AlertCircle, Calendar, User } from 'lucide-react';
import axios from 'axios';

export default function NotificationsWidget({ onNavigate }) {
  const [otList, setOtList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOTNotifications();
  }, []);

  const fetchOTNotifications = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const token = localStorage.getItem('token');
      
      const res = await axios.get(`/overtime/admin/list?month=${month}&year=${year}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (Array.isArray(res.data)) {
        setOtList(res.data);
      } else {
        setOtList([]);
      }
    } catch (err) {
      console.warn('API fetch OT notifications fallback:', err);
      setOtList([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGoToOT = () => {
    if (onNavigate) {
      onNavigate('employees');
    }
  };

  // Sort newest OT notifications to the top (descending by created_at / work_date and ID)
  const sortedList = Array.isArray(otList) ? [...otList].sort((a, b) => {
    const timeA = new Date(a.created_at || a.work_date || 0).getTime();
    const timeB = new Date(b.created_at || b.work_date || 0).getTime();
    if (timeB !== timeA) return timeB - timeA;
    return (b.id || 0) - (a.id || 0);
  }) : [];

  const displayItems = sortedList.slice(0, 8);
  const pendingCount = sortedList.filter(i => i.status === 'Pending').length;

  return (
    <div className="vt-card animate-fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header Bar */}
      <div className="vt-card-title-bar" style={{ paddingBottom: 14, borderBottom: '1px solid #F1F5F9', marginBottom: 14 }}>
        <div className="vt-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1rem', fontWeight: 700 }}>
          <Bell size={18} style={{ color: '#EE0033' }} />
          <span>Thông báo Đăng ký OT</span>
          {pendingCount > 0 && (
            <span style={{ background: '#EE0033', color: 'white', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>
              {pendingCount} chờ duyệt
            </span>
          )}
        </div>
        <button 
          className="vt-btn-link" 
          onClick={handleGoToOT}
          style={{ fontSize: '0.8rem', color: '#2563EB', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <span>Chi tiết OT</span>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* OT Notification List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#94A3B8', fontSize: '0.85rem' }}>
            Đang nạp thông báo OT...
          </div>
        ) : displayItems.length > 0 ? (
          displayItems.map((item) => {
            const isPending = item.status === 'Pending';
            const isApproved = item.status === 'Approved';
            
            return (
              <div 
                key={item.id} 
                onClick={handleGoToOT}
                style={{ 
                  background: isPending ? '#FFFBEB' : '#F8FAFC',
                  border: isPending ? '1px solid #FDE68A' : '1px solid #E2E8F0',
                  borderRadius: 10,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12
                }}
                className="vt-notif-hover-card"
                title="Bấm vào để chuyển tới danh sách quản lý OT chi tiết"
              >
                <div style={{ flex: 1 }}>
                  {/* Employee Name & Code */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <User size={14} style={{ color: '#64748B' }} />
                    <strong style={{ fontSize: '0.88rem', color: '#0F172A' }}>
                      {item.full_name || item.user_name || 'Nhân viên'}
                    </strong>
                    <span style={{ fontSize: '0.75rem', color: '#EE0033', fontWeight: 700 }}>
                      ({item.employee_code || item.user_code || 'NV'})
                    </span>
                  </div>

                  {/* Time & Project */}
                  <div style={{ fontSize: '0.78rem', color: '#475569', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={12} style={{ color: '#64748B' }} />
                      {item.work_date} ({item.start_time} - {item.end_time})
                    </span>
                    <span style={{ color: '#CBD5E1' }}>•</span>
                    <span style={{ color: '#2563EB', fontWeight: 600 }}>
                      {item.project || 'CNTT'}
                    </span>
                  </div>

                  {/* Reason if available */}
                  {item.reason && (
                    <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 3, fontStyle: 'italic' }}>
                      Lý do: "{item.reason}"
                    </div>
                  )}
                </div>

                {/* Status Badge */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {isPending ? (
                    <span style={{ background: '#FEF3C7', color: '#D97706', border: '1px solid #FCD34D', padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <AlertCircle size={12} />
                      Chờ duyệt
                    </span>
                  ) : isApproved ? (
                    <span style={{ background: '#D1FAE5', color: '#059669', border: '1px solid #6EE7B7', padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 size={12} />
                      Đã duyệt
                    </span>
                  ) : (
                    <span style={{ background: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5', padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <XCircle size={12} />
                      Từ chối
                    </span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ textAlign: 'center', padding: 30, color: '#94A3B8', fontSize: '0.85rem' }}>
            Chưa có thông báo đăng ký OT nào trong tháng này.
          </div>
        )}
      </div>

      {/* Footer Navigation Link */}
      <div style={{ marginTop: 14, pt: 12, borderTop: '1px solid #F1F5F9', textAlign: 'center' }}>
        <button 
          onClick={handleGoToOT}
          style={{ width: '100%', padding: '9px 16px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, color: '#2563EB', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <span>Xem Toàn Bộ Danh Sách Chi Tiết OT ➔</span>
        </button>
      </div>
    </div>
  );
}
