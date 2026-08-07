import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Clock, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, 
  XCircle, Plus, Edit2, Trash2, Download, Search, CheckCheck, X,
  Calendar as CalendarIcon, Filter, User, Building, ListFilter, Table
} from 'lucide-react';
import axios from 'axios';

export default function OvertimePage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({
    total_raw_hours: 0,
    total_weighted_hours: 0,
    pending_count: 0,
    approved_count: 0,
    rejected_count: 0,
    is_onsite: true,
    has_project: true
  });
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState({ text: '', type: '' });

  // Date Navigation State
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  // Real-time live clock in header
  const [liveTime, setLiveTime] = useState('');

  // Admin specific states
  const [adminTab, setAdminTab] = useState('list'); // 'list' | 'summary'
  const [filterStatus, setFilterStatus] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterName, setFilterName] = useState('');
  const [summaryDetailEmp, setSummaryDetailEmp] = useState(null); // Employee selected for monthly detail popup

  // Employee Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [startTime, setStartTime] = useState('18:30');
  const [endTime, setEndTime] = useState('');
  const [isHoliday, setIsHoliday] = useState(false);
  const [reason, setReason] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [timeWarning, setTimeWarning] = useState('');

  // Lock background body scroll when modal is open
  useEffect(() => {
    if (isModalOpen || summaryDetailEmp) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isModalOpen, summaryDetailEmp]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('user');
      if (saved) setCurrentUser(JSON.parse(saved));
    } catch (_) {}
  }, []);

  // Update live clock every second
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
      setLiveTime(`${timeStr} ${dateStr}`);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    fetchOvertimeData();
  }, [currentMonth, currentYear, adminTab, filterStatus, filterProject, filterName, isAdmin]);

  const fetchOvertimeData = async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        if (adminTab === 'summary') {
          const params = new URLSearchParams({
            month: currentMonth,
            year: currentYear,
            ...(filterProject ? { project: filterProject } : {})
          });
          const res = await axios.get(`/overtime/admin/summary?${params}`);
          setSummaryData(res.data);
        } else {
          const params = new URLSearchParams({
            month: currentMonth,
            year: currentYear,
            ...(filterStatus ? { status: filterStatus } : {}),
            ...(filterProject ? { project: filterProject } : {}),
            ...(filterName ? { employee_name: filterName } : {})
          });
          const res = await axios.get(`/overtime/admin/list?${params}`);
          setRecords(Array.isArray(res.data) ? res.data : []);
        }
      } else {
        // Employee / Intern
        const [recsRes, statsRes] = await Promise.all([
          axios.get(`/overtime/my?month=${currentMonth}&year=${currentYear}`),
          axios.get(`/overtime/my/stats?month=${currentMonth}&year=${currentYear}`).catch(() => ({ data: null }))
        ]);

        const recs = Array.isArray(recsRes.data) ? recsRes.data : [];
        setRecords(recs);

        if (statsRes.data) {
          setStats(statsRes.data);
        } else {
          const approved = recs.filter(r => r.status === 'Approved');
          setStats({
            total_raw_hours: approved.reduce((acc, r) => acc + (r.raw_hours || 0), 0),
            total_weighted_hours: approved.reduce((acc, r) => acc + (r.weighted_hours || 0), 0),
            pending_count: recs.filter(r => r.status === 'Pending').length,
            approved_count: approved.length,
            rejected_count: recs.filter(r => r.status === 'Rejected').length,
            is_onsite: true,
            has_project: true
          });
        }
      }
    } catch (err) {
      console.warn('Overtime fetch warning:', err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (text, type = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg({ text: '', type: '' }), 4500);
  };

  // Month navigation for employee calendar
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // Admin Actions
  const handleAdminApprove = async (id) => {
    try {
      await axios.post(`/overtime/admin/${id}/approve`);
      showToast('Đã duyệt phiếu OT thành công! CSDL đã được cập nhật.', 'success');
      fetchOvertimeData();
    } catch (err) {
      alert('Lỗi phê duyệt OT: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleAdminReject = async (id) => {
    const rejectReason = prompt('Nhập lý do từ chối phiếu OT:');
    if (!rejectReason) return;
    try {
      await axios.post(`/overtime/admin/${id}/reject`, { reject_reason: rejectReason });
      showToast('Đã từ chối phiếu OT kèm lý do.', 'info');
      fetchOvertimeData();
    } catch (err) {
      alert('Lỗi từ chối OT: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleAdminApproveAll = async () => {
    if (!window.confirm(`Duyệt toàn bộ phiếu OT đang Chờ duyệt trong Tháng ${currentMonth}/${currentYear}?`)) return;
    try {
      await axios.post(`/overtime/admin/approve-all-pending?month=${currentMonth}&year=${currentYear}`);
      showToast('Đã duyệt tất cả phiếu OT Chờ duyệt thành công!', 'success');
      fetchOvertimeData();
    } catch (err) {
      alert('Lỗi duyệt tất cả: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleExportExcel = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/overtime/admin/export?month=${currentMonth}&year=${currentYear}${filterProject ? `&project=${filterProject}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Phu_Luc_02_Bao_Cao_OT_Thang_${currentMonth}_${currentYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Lỗi xuất Excel: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Employee Calendar Calculations
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const firstDayDow = new Date(currentYear, currentMonth - 1, 1).getDay();
  const startOffset = firstDayDow === 0 ? 6 : firstDayDow - 1;

  const dayRecordsMap = {};
  records.forEach(r => {
    if (!r.work_date) return;
    const parts = r.work_date.split('-');
    if (parts.length === 3) {
      const d = parseInt(parts[2], 10);
      if (!dayRecordsMap[d]) dayRecordsMap[d] = [];
      dayRecordsMap[d].push(r);
    }
  });

  const handleDayClick = (dayNum) => {
    const formattedDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const dObj = new Date(currentYear, currentMonth - 1, dayNum);
    const dow = dObj.getDay();
    const isWeekend = dow === 0 || dow === 6;

    setEditId(null);
    setSelectedDate(formattedDate);
    setStartTime(isWeekend ? '08:00' : '18:30');
    setEndTime('');
    setIsHoliday(false);
    setReason('');
    setPreviewData(null);
    setTimeWarning('');
    setIsModalOpen(true);
  };

  const handleEditRecord = (record) => {
    setEditId(record.id);
    setSelectedDate(record.work_date);
    setStartTime(record.start_time);
    setEndTime(record.end_time);
    setIsHoliday(record.factor >= 3.0);
    setReason(record.reason || '');
    setTimeWarning('');
    setIsModalOpen(true);
  };

  const handleDeleteRecord = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa đăng ký OT này?')) return;
    try {
      await axios.delete(`/overtime/${id}`);
      showToast('Đã xóa đăng ký OT thành công.', 'success');
      fetchOvertimeData();
    } catch (err) {
      alert('Lỗi xóa OT: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Live preview calculation for employee modal
  useEffect(() => {
    if (!isModalOpen || !startTime || !endTime || !selectedDate) {
      setPreviewData(null);
      return;
    }

    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;

    const dObj = new Date(selectedDate + 'T00:00:00');
    const dow = dObj.getDay();
    const isWeekend = dow === 0 || dow === 6;

    if (!isWeekend && startMin < 18 * 60 + 30) {
      setTimeWarning('Thứ 2–Thứ 6: Giờ bắt đầu OT phải từ 18:30 trở đi!');
      setPreviewData(null);
      return;
    }
    if (endMin <= startMin) {
      setTimeWarning('Giờ kết thúc phải lớn hơn giờ bắt đầu!');
      setPreviewData(null);
      return;
    }

    setTimeWarning('');

    const timer = setTimeout(async () => {
      try {
        const res = await axios.post('/overtime/preview', {
          work_date: selectedDate,
          start_time: startTime,
          end_time: endTime,
          is_holiday: isHoliday
        });
        setPreviewData(res.data);
      } catch (err) {
        const splitHour = 22 * 60;
        let segs = [];
        const getFactor = (before22) => {
          if (isHoliday) return before22 ? 3.0 : 3.9;
          if (isWeekend) return before22 ? 2.0 : 2.7;
          return before22 ? 1.5 : 2.1;
        };

        if (startMin < splitHour && endMin > splitHour) {
          const raw1 = Number(((splitHour - startMin) / 60).toFixed(2));
          const f1 = getFactor(true);
          segs.push({
            start_time: startTime,
            end_time: '22:00',
            raw_hours: raw1,
            factor: f1,
            weighted_hours: Number((raw1 * f1).toFixed(2))
          });
          const raw2 = Number(((endMin - splitHour) / 60).toFixed(2));
          const f2 = getFactor(false);
          segs.push({
            start_time: '22:00',
            end_time: endTime,
            raw_hours: raw2,
            factor: f2,
            weighted_hours: Number((raw2 * f2).toFixed(2))
          });
        } else {
          const raw = Number(((endMin - startMin) / 60).toFixed(2));
          const f = getFactor(endMin <= splitHour);
          segs.push({
            start_time: startTime,
            end_time: endTime,
            raw_hours: raw,
            factor: f,
            weighted_hours: Number((raw * f).toFixed(2))
          });
        }

        const totalRaw = segs.reduce((a, b) => a + b.raw_hours, 0);
        const totalWeighted = segs.reduce((a, b) => a + b.weighted_hours, 0);
        setPreviewData({
          segments: segs,
          total_raw_hours: totalRaw,
          total_weighted_hours: totalWeighted
        });
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [startTime, endTime, isHoliday, selectedDate, isModalOpen]);

  const handleSubmitOT = async (e) => {
    e.preventDefault();
    if (!startTime || !endTime) {
      alert('Vui lòng chọn đầy đủ giờ bắt đầu và giờ kết thúc.');
      return;
    }

    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;

    const dObj = new Date(selectedDate + 'T00:00:00');
    const dow = dObj.getDay();
    const isWeekend = dow === 0 || dow === 6;

    if (!isWeekend && startMin < 18 * 60 + 30) {
      alert('Thứ 2 đến Thứ 6: Giờ bắt đầu OT phải từ 18:30 trở đi!');
      return;
    }
    if (endMin <= startMin) {
      alert('Giờ kết thúc phải lớn hơn giờ bắt đầu!');
      return;
    }

    setModalLoading(true);
    try {
      const payload = {
        start_time: startTime,
        end_time: endTime,
        is_holiday: isHoliday,
        reason: reason.trim() || null
      };

      if (editId) {
        await axios.put(`/overtime/${editId}`, payload);
        showToast('Cập nhật đăng ký OT thành công! Trạng thái chuyển về Chờ duyệt.', 'success');
      } else {
        payload.work_date = selectedDate;
        const res = await axios.post('/overtime/', payload);
        if (res.data?.segments === 2) {
          showToast('Đăng ký OT thành công! Đã tự động phân tách khung giờ trước và sau 22:00.', 'success');
        } else {
          showToast('Đăng ký OT thành công! Phiếu đã gửi tới Admin ở trạng thái Chờ duyệt.', 'success');
        }
      }

      setIsModalOpen(false);
      fetchOvertimeData();
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Lỗi đăng ký OT';
      alert('Không thể lưu OT: ' + msg);
    } finally {
      setModalLoading(false);
    }
  };

  const formatModalDate = (dStr) => {
    if (!dStr) return '';
    const parts = dStr.split('-');
    if (parts.length === 3) {
      return `${parts[1]}/${parts[2]}/${parts[0]}`;
    }
    return dStr;
  };

  // ═════════════════════════════════════════════════════════════════════════════════════════
  // RENDER: ADMIN OVERTIME APPROVAL & MANAGEMENT INTERFACE (NO CALENDAR GRID)
  // ═════════════════════════════════════════════════════════════════════════════════════════
  if (isAdmin) {
    const pendingList = records.filter(r => r.status === 'Pending');
    const approvedList = records.filter(r => r.status === 'Approved');
    const rejectedList = records.filter(r => r.status === 'Rejected');

    return (
      <div className="animate-fade-in" style={{ width: '100%' }}>
        
        {/* Admin Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#EE0033', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={24} style={{ color: '#EE0033' }} />
              <span>Quản lý & Phê duyệt Chấm công OT</span>
            </h2>
            <p style={{ color: '#64748B', fontSize: '0.85rem', margin: '3px 0 0 0' }}>
              Kiểm duyệt các phiếu đăng ký làm thêm giờ của nhân sự và tự động cập nhật dữ liệu vào CSDL
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button 
              className="vt-btn-primary" 
              onClick={handleExportExcel}
              style={{ background: '#059669', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 15px', fontSize: '0.85rem' }}
            >
              <Download size={15} />
              <span>Xuất Excel Phụ Lục 02</span>
            </button>

            <button 
              className="vt-btn-primary" 
              onClick={handleAdminApproveAll}
              style={{ background: '#2563EB', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 15px', fontSize: '0.85rem' }}
            >
              <CheckCheck size={15} />
              <span>Duyệt tất cả Chờ duyệt</span>
            </button>
          </div>
        </div>

        {/* Toast Notification */}
        {toastMsg.text && (
          <div style={{ 
            background: toastMsg.type === 'success' ? '#DCFCE7' : '#FEE2E2', 
            color: toastMsg.type === 'success' ? '#15803D' : '#DC2626', 
            border: `1px solid ${toastMsg.type === 'success' ? '#86EFAC' : '#FCA5A5'}`,
            padding: '10px 14px', borderRadius: 8, fontSize: '0.88rem', fontWeight: 600, 
            marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 
          }}>
            {toastMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{toastMsg.text}</span>
          </div>
        )}

        {/* Admin Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
          <div className="vt-card" style={{ padding: 14, background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>
              Tổng số phiếu tháng {currentMonth}/{currentYear}
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A' }}>
              {records.length}
            </div>
          </div>

          <div className="vt-card" style={{ padding: 14, background: '#FFFBEB', borderRadius: 12, border: '1px solid #FDE68A', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#D97706', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>
              Chờ duyệt
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#D97706' }}>
              {pendingList.length}
            </div>
          </div>

          <div className="vt-card" style={{ padding: 14, background: '#ECFDF5', borderRadius: 12, border: '1px solid #A7F3D0', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>
              Đã duyệt
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#059669' }}>
              {approvedList.length}
            </div>
          </div>

          <div className="vt-card" style={{ padding: 14, background: '#FEF2F2', borderRadius: 12, border: '1px solid #FECACA', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>
              Từ chối
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#DC2626' }}>
              {rejectedList.length}
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="vt-card" style={{ padding: 16, background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0', marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Tháng</label>
              <select 
                className="vt-input"
                value={currentMonth} 
                onChange={(e) => setCurrentMonth(Number(e.target.value))}
                style={{ padding: '7px 10px', fontSize: '0.85rem' }}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>Tháng {String(i + 1).padStart(2, '0')}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Năm</label>
              <input 
                type="number" 
                className="vt-input" 
                value={currentYear} 
                onChange={(e) => setCurrentYear(Number(e.target.value))}
                style={{ padding: '7px 10px', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Dự án</label>
              <input 
                type="text" 
                className="vt-input" 
                placeholder="Tên dự án..."
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                style={{ padding: '7px 10px', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Tên nhân viên</label>
              <input 
                type="text" 
                className="vt-input" 
                placeholder="Họ và tên..."
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                style={{ padding: '7px 10px', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Trạng thái</label>
              <select 
                className="vt-input"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ padding: '7px 10px', fontSize: '0.85rem' }}
              >
                <option value="">-- Tất cả --</option>
                <option value="Pending">Chờ duyệt</option>
                <option value="Approved">Đã duyệt</option>
                <option value="Rejected">Từ chối</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sub-Tabs: Danh sách chi tiết vs Bảng tổng hợp tháng */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div className="vt-sub-nav-bar" style={{ margin: 0 }}>
            <button 
              className={`vt-sub-nav-pill ${adminTab === 'list' ? 'active' : ''}`}
              onClick={() => setAdminTab('list')}
            >
              <ListFilter size={15} />
              <span>Danh sách phiếu OT chi tiết</span>
            </button>
            <button 
              className={`vt-sub-nav-pill ${adminTab === 'summary' ? 'active' : ''}`}
              onClick={() => setAdminTab('summary')}
            >
              <Table size={15} />
              <span>Bảng tổng hợp OT theo tháng</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Detailed List Table for Admin */}
        {adminTab === 'list' && (
          <div className="vt-card" style={{ padding: 20, background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569' }}>Nhân sự</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569' }}>Dự án</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569' }}>Ngày OT</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569' }}>Khung giờ</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569', textAlign: 'center' }}>Thực tế</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569', textAlign: 'center' }}>Hệ số</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569', textAlign: 'center' }}>Quy đổi</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569' }}>Trạng thái</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569' }}>Lý do OT</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length > 0 ? (
                    records.map((r) => {
                      const isPending = r.status === 'Pending';
                      const isApproved = r.status === 'Approved';
                      const isRejected = r.status === 'Rejected';

                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.1s ease' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <strong style={{ color: '#0F172A', display: 'block' }}>{r.full_name || 'Nhân viên'}</strong>
                            <span style={{ fontSize: '0.72rem', color: '#EE0033', fontWeight: 700 }}>
                              {r.employee_code}
                            </span>
                          </td>

                          <td style={{ padding: '10px 12px', color: '#2563EB', fontWeight: 600 }}>
                            {r.project || '—'}
                          </td>

                          <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1E293B' }}>
                            {r.work_date}
                          </td>

                          <td style={{ padding: '10px 12px', color: '#475569' }}>
                            {r.start_time} – {r.end_time}
                          </td>

                          <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>
                            {r.raw_hours}h
                          </td>

                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <span style={{ background: '#F1F5F9', color: '#475569', padding: '2px 7px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 700 }}>
                              {r.factor}x
                            </span>
                          </td>

                          <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, color: '#EE0033', fontSize: '0.9rem' }}>
                            {r.weighted_hours}h
                          </td>

                          <td style={{ padding: '10px 12px' }}>
                            {isApproved && (
                              <span style={{ background: 'rgba(5, 150, 105, 0.1)', color: '#059669', border: '1px solid rgba(5, 150, 105, 0.3)', padding: '2px 8px', borderRadius: 16, fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <CheckCircle2 size={12} />
                                Đã duyệt
                              </span>
                            )}
                            {isPending && (
                              <span style={{ background: 'rgba(217, 119, 6, 0.1)', color: '#D97706', border: '1px solid rgba(217, 119, 6, 0.3)', padding: '2px 8px', borderRadius: 16, fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <Clock size={12} />
                                Chờ duyệt
                              </span>
                            )}
                            {isRejected && (
                              <span style={{ background: 'rgba(220, 38, 38, 0.1)', color: '#DC2626', border: '1px solid rgba(220, 38, 38, 0.3)', padding: '2px 8px', borderRadius: 16, fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <XCircle size={12} />
                                Từ chối
                              </span>
                            )}
                          </td>

                          <td style={{ padding: '10px 12px', color: '#64748B', maxWidth: 200 }}>
                            <div style={{ fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.reason || '—'}>
                              {r.reason || '—'}
                            </div>
                            {r.reject_reason && (
                              <div style={{ fontSize: '0.72rem', color: '#DC2626', marginTop: 2, fontStyle: 'italic' }}>
                                Lý do từ chối: {r.reject_reason}
                              </div>
                            )}
                          </td>

                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                              {isPending ? (
                                <>
                                  <button 
                                    onClick={() => handleAdminApprove(r.id)}
                                    style={{ background: '#059669', color: '#FFF', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                                  >
                                    <CheckCircle2 size={12} />
                                    Duyệt
                                  </button>
                                  <button 
                                    onClick={() => handleAdminReject(r.id)}
                                    style={{ background: '#DC2626', color: '#FFF', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                                  >
                                    <XCircle size={12} />
                                    Từ chối
                                  </button>
                                </>
                              ) : isRejected ? (
                                <button 
                                  onClick={() => handleAdminApprove(r.id)}
                                  style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#059669', padding: '4px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                                >
                                  Duyệt lại
                                </button>
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>
                                  Đã ghi nhận
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: '36px 20px', color: '#94A3B8' }}>
                        {loading ? 'Đang tải dữ liệu chấm công OT...' : 'Không tìm thấy phiếu đăng ký OT nào phù hợp với bộ lọc.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Monthly Aggregated Summary for Admin */}
        {adminTab === 'summary' && summaryData && (
          <div className="vt-card" style={{ padding: 20, background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Bảng tổng hợp công OT Tháng {String(currentMonth).padStart(2, '0')}/{currentYear}
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '3px 0 0 0' }}>
                  💡 Bấm vào bất kỳ dòng nào hoặc nút <strong>"Xem chi tiết"</strong> để xem bảng kê từng ngày trong tháng, thứ mấy và hệ số quy đổi
                </p>
              </div>

              <button className="vt-btn-primary" onClick={handleExportExcel} style={{ background: '#059669', padding: '7px 14px', fontSize: '0.82rem' }}>
                <Download size={14} />
                <span>Tải file Excel Phụ Lục 02</span>
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #CBD5E1' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>STT</th>
                    <th style={{ padding: '10px 12px' }}>Mã NV</th>
                    <th style={{ padding: '10px 12px' }}>Họ và tên</th>
                    <th style={{ padding: '10px 12px' }}>Dự án</th>
                    <th style={{ padding: '10px 12px' }}>Các ngày OT trong tháng</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Tổng giờ thực tế</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Tổng giờ quy đổi</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(summaryData.rows) && summaryData.rows.length > 0 ? (
                    summaryData.rows.map((row, idx) => {
                      const totalRaw = row.total_raw_hours ?? row.total_raw ?? 0;
                      const totalWeighted = row.total_weighted_hours ?? row.total_weighted ?? 0;
                      const details = row.detail_records || [];

                      return (
                        <tr 
                          key={idx} 
                          onClick={() => setSummaryDetailEmp(row)}
                          style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer', transition: 'background 0.15s ease' }}
                          className="vt-cal-day-cell"
                        >
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>{idx + 1}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: '#EE0033' }}>{row.employee_code}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>{row.full_name}</td>
                          <td style={{ padding: '10px 12px', color: '#64748B' }}>{row.project || '—'}</td>

                          {/* Column: Các ngày OT trong tháng */}
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                              {details.length > 0 ? (
                                details.map((d, dIdx) => (
                                  <span 
                                    key={dIdx}
                                    style={{ 
                                      background: d.is_weekend ? '#FFF1F2' : '#F1F5F9', 
                                      color: d.is_weekend ? '#EE0033' : '#1E293B',
                                      border: `1px solid ${d.is_weekend ? '#FECACA' : '#CBD5E1'}`,
                                      padding: '2px 7px', 
                                      borderRadius: 6, 
                                      fontSize: '0.74rem', 
                                      fontWeight: 700,
                                      whiteSpace: 'nowrap'
                                    }}
                                    title={`${d.day_of_week} ngày ${d.date_display}: ${d.raw_hours}h (${d.start_time}–${d.end_time})`}
                                  >
                                    {d.date_display ? d.date_display.split('/')[0] : d.work_date?.split('-')[2]}/{String(currentMonth).padStart(2, '0')} ({d.raw_hours}h)
                                  </span>
                                ))
                              ) : (
                                <span style={{ color: '#94A3B8', fontSize: '0.75rem' }}>Chưa có ngày nào</span>
                              )}
                            </div>
                          </td>

                          <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#1E293B' }}>{totalRaw}h</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, color: '#EE0033' }}>{totalWeighted}h</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSummaryDetailEmp(row);
                              }}
                              style={{ 
                                background: '#EFF6FF', 
                                border: '1px solid #BFDBFE', 
                                color: '#2563EB', 
                                padding: '4px 10px', 
                                borderRadius: 6, 
                                fontSize: '0.75rem', 
                                fontWeight: 700, 
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              Xem chi tiết
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: '#94A3B8' }}>
                        Chưa có dữ liệu tổng hợp tháng này.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Modal Chi Tiết Từng Ngày Trong Tháng (Rendered via Portal to Document Body - Dead Center & No Sliding) ── */}
        {summaryDetailEmp && typeof document !== 'undefined' && createPortal(
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) setSummaryDetailEmp(null);
            }}
            style={{ 
              position: 'fixed', 
              top: 0, 
              left: 0, 
              width: '100vw',
              height: '100vh',
              background: 'rgba(15, 23, 42, 0.7)', 
              backdropFilter: 'blur(5px)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              zIndex: 999999,
              padding: '16px',
              boxSizing: 'border-box'
            }}
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              style={{ 
                background: '#FFFFFF', 
                borderRadius: 16, 
                width: '100%', 
                maxWidth: 860, 
                boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.4)',
                border: '1px solid #E2E8F0',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '92vh',
                overflow: 'hidden',
                boxSizing: 'border-box'
              }}
            >
              
              {/* Modal Header */}
              <div style={{ 
                padding: '16px 22px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                borderBottom: '1px solid #F1F5F9', 
                background: '#FFFFFF',
                flexShrink: 0
              }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>Chi tiết Chấm công OT — {summaryDetailEmp.full_name}</span>
                    <span style={{ fontSize: '0.8rem', color: '#EE0033', background: '#FFF1F2', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                      {summaryDetailEmp.employee_code}
                    </span>
                  </h3>
                  <p style={{ color: '#64748B', fontSize: '0.82rem', margin: '4px 0 0 0' }}>
                    Dự án: <strong style={{ color: '#2563EB' }}>{summaryDetailEmp.project || '—'}</strong> • Tháng {String(currentMonth).padStart(2, '0')}/{currentYear}
                  </p>
                </div>

                <button 
                  type="button"
                  onClick={() => setSummaryDetailEmp(null)}
                  style={{ 
                    background: 'transparent', 
                    border: 'none', 
                    color: '#94A3B8', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center',
                    padding: 4,
                    borderRadius: 6,
                    transition: 'all 0.15s ease'
                  }}
                  title="Đóng"
                >
                  <X size={22} />
                </button>
              </div>

              {/* ── Compact Full-Month Calendar Grid (Y như giao diện nhân viên nhưng gọn hơn & có thông số nhân cụ thể) ── */}
              <div style={{ padding: '14px 22px', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CalendarIcon size={16} style={{ color: '#EE0033' }} />
                    <span>Lịch chấm công OT Tháng {String(currentMonth).padStart(2, '0')}/{currentYear} của {summaryDetailEmp.full_name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, fontSize: '0.74rem', fontWeight: 600 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#059669' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#059669' }}></span> Đã duyệt
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#D97706' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#D97706' }}></span> Chờ duyệt
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#DC2626' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#DC2626' }}></span> Từ chối
                    </span>
                  </div>
                </div>

                {/* Weekday Columns Header (T2 -> CN with T7/CN in pink) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center', fontWeight: 700, fontSize: '0.76rem', marginBottom: 4 }}>
                  {['T2', 'T3', 'T4', 'T5', 'T6'].map(d => (
                    <div key={d} style={{ padding: '4px 0', background: '#F8FAFC', color: '#475569', borderRadius: 6 }}>
                      {d}
                    </div>
                  ))}
                  {['T7', 'CN'].map(d => (
                    <div key={d} style={{ padding: '4px 0', background: '#FFF1F2', color: '#EE0033', borderRadius: 6 }}>
                      {d}
                    </div>
                  ))}
                </div>

                {/* Mini Calendar Days Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                  {Array.from({ length: startOffset }).map((_, i) => (
                    <div key={`modal-offset-${i}`} style={{ minHeight: 56, background: '#F8FAFC', opacity: 0.4, borderRadius: 6 }}></div>
                  ))}

                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const dayNum = i + 1;
                    const dObj = new Date(currentYear, currentMonth - 1, dayNum);
                    const dow = dObj.getDay();
                    const isWeekend = dow === 0 || dow === 6;
                    const dayRecs = summaryDetailEmp.days?.[dayNum] || [];
                    const hasOT = dayRecs.length > 0;
                    const totalDayRaw = dayRecs.reduce((acc, r) => acc + (r.raw_hours || 0), 0);
                    const totalDayWeighted = dayRecs.reduce((acc, r) => acc + (r.weighted_hours || 0), 0);

                    return (
                      <div 
                        key={`modal-day-${dayNum}`}
                        style={{ 
                          minHeight: 56, 
                          background: hasOT ? (isWeekend ? '#FFF1F2' : '#EFF6FF') : (isWeekend ? 'rgba(238, 0, 51, 0.02)' : '#FFFFFF'), 
                          border: hasOT ? '1.5px solid #EE0033' : '1px solid #E2E8F0', 
                          borderRadius: 6, 
                          padding: '4px 5px', 
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          boxShadow: hasOT ? '0 1px 4px rgba(238,0,51,0.1)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {/* Top: Day number */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', lineHeight: 1 }}>
                          <span style={{ 
                            fontSize: '0.74rem', 
                            fontWeight: 700, 
                            color: isWeekend ? '#EE0033' : '#1E293B',
                            background: isWeekend ? 'transparent' : '#F1F5F9',
                            padding: isWeekend ? 0 : '1px 4px',
                            borderRadius: 3
                          }}>
                            {dayNum}
                          </span>

                          {hasOT && (
                            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#EE0033' }}>
                              {totalDayRaw}h
                            </span>
                          )}
                        </div>

                        {/* Center: Factor badges + Hours */}
                        {hasOT ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, margin: '2px 0' }}>
                            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
                              {dayRecs.map((r, rIdx) => (
                                <span 
                                  key={rIdx}
                                  style={{ 
                                    background: '#DBEAFE', 
                                    color: '#1E40AF', 
                                    padding: '1px 4px', 
                                    borderRadius: 4, 
                                    fontSize: '0.66rem', 
                                    fontWeight: 800 
                                  }}
                                  title={`${r.start_time}–${r.end_time}: ${r.raw_hours}h x ${r.factor} = ${r.weighted_hours}h`}
                                >
                                  {r.factor}x
                                </span>
                              ))}
                            </div>
                            <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>
                              → {totalDayWeighted}h
                            </span>
                          </div>
                        ) : (
                          <div style={{ flexGrow: 1 }}></div>
                        )}

                        {/* Bottom: Status Dot */}
                        <div style={{ display: 'flex', gap: 3, justifyContent: 'center', minHeight: 4 }}>
                          {dayRecs.map((r, rIdx) => {
                            const dotCol = r.status === 'Approved' ? '#059669' : r.status === 'Pending' ? '#D97706' : '#DC2626';
                            return (
                              <span 
                                key={rIdx} 
                                style={{ width: 5, height: 5, borderRadius: '50%', background: dotCol, display: 'inline-block' }}
                              ></span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Day-by-day Breakdown Table */}
              <div style={{ padding: '14px 22px', overflowY: 'auto', flexGrow: 1, maxHeight: 220 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569' }}>Ngày</th>
                      <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569' }}>Thứ</th>
                      <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569' }}>Khung giờ</th>
                      <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569', textAlign: 'center' }}>Thực tế</th>
                      <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569', textAlign: 'center' }}>Hệ số</th>
                      <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569', textAlign: 'center' }}>Quy đổi</th>
                      <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569' }}>Trạng thái</th>
                      <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569' }}>Lý do OT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.isArray(summaryDetailEmp.detail_records) && summaryDetailEmp.detail_records.length > 0 ? (
                      summaryDetailEmp.detail_records.map((d, dIdx) => {
                        const isWeekend = d.is_weekend;
                        const isApproved = d.status === 'Approved';
                        const isPending = d.status === 'Pending';
                        const isRejected = d.status === 'Rejected';

                        return (
                          <tr key={dIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 700, color: '#1E293B' }}>
                              {d.date_display || d.work_date}
                            </td>

                            <td style={{ padding: '8px 10px' }}>
                              <span style={{ 
                                background: isWeekend ? '#FFF1F2' : '#F1F5F9', 
                                color: isWeekend ? '#EE0033' : '#475569', 
                                padding: '2px 6px', 
                                borderRadius: 4, 
                                fontWeight: 700,
                                fontSize: '0.74rem'
                              }}>
                                {d.day_of_week}
                              </span>
                            </td>

                            <td style={{ padding: '8px 10px', color: '#475569' }}>
                              {d.start_time} – {d.end_time}
                            </td>

                            <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>
                              {d.raw_hours}h
                            </td>

                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <span style={{ background: '#DBEAFE', color: '#1E40AF', padding: '2px 6px', borderRadius: 6, fontWeight: 800, fontSize: '0.75rem' }}>
                                {d.factor}x
                              </span>
                            </td>

                            <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800, color: '#EE0033', fontSize: '0.88rem' }}>
                              {d.weighted_hours}h
                            </td>

                            <td style={{ padding: '8px 10px' }}>
                              {isApproved && (
                                <span style={{ background: '#DCFCE7', color: '#15803D', padding: '2px 7px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700 }}>
                                  Đã duyệt
                                </span>
                              )}
                              {isPending && (
                                <span style={{ background: '#FEF3C7', color: '#B45309', padding: '2px 7px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700 }}>
                                  Chờ duyệt
                                </span>
                              )}
                              {isRejected && (
                                <span style={{ background: '#FEE2E2', color: '#B91C1C', padding: '2px 7px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700 }}>
                                  Từ chối
                                </span>
                              )}
                            </td>

                            <td style={{ padding: '8px 10px', color: '#64748B', maxWidth: 160 }}>
                              <div style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.reason || '—'}>
                                {d.reason || '—'}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: 18, color: '#94A3B8' }}>
                          Không có bản ghi chi tiết nào.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Modal Footer */}
              <div style={{ 
                padding: '10px 22px', 
                borderTop: '1px solid #F1F5F9', 
                background: '#F8FAFC', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                flexShrink: 0
              }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                  Tổng cộng: <strong style={{ color: '#0F172A' }}>{summaryDetailEmp.total_raw_hours ?? 0}h thực tế</strong> → <strong style={{ color: '#EE0033' }}>{summaryDetailEmp.total_weighted_hours ?? 0}h quy đổi</strong>
                </div>

                <button 
                  type="button" 
                  onClick={() => setSummaryDetailEmp(null)}
                  style={{ 
                    background: '#64748B', 
                    color: '#FFFFFF', 
                    border: 'none', 
                    borderRadius: 8, 
                    padding: '6px 18px', 
                    fontWeight: 700, 
                    fontSize: '0.84rem', 
                    cursor: 'pointer' 
                  }}
                >
                  Đóng
                </button>
              </div>

            </div>
          </div>,
          document.body
        )}

      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════════════════
  // RENDER: EMPLOYEE / INTERN OVERTIME & CALENDAR REGISTRATION INTERFACE
  // ═════════════════════════════════════════════════════════════════════════════════════════
  return (
    <div className="vt-container animate-fade-in" style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 16px' }}>
      
      {/* Employee Header with Real-time Clock */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Clock size={28} style={{ color: '#EE0033' }} />
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#EE0033', margin: 0, letterSpacing: '-0.5px' }}>
            Chấm công OT
          </h1>
        </div>

        {liveTime && (
          <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem', color: '#1E293B', background: '#FFFFFF', padding: '6px 14px', borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            {liveTime}
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toastMsg.text && (
        <div style={{ 
          background: toastMsg.type === 'success' ? '#DCFCE7' : '#FEE2E2', 
          color: toastMsg.type === 'success' ? '#15803D' : '#DC2626', 
          border: `1px solid ${toastMsg.type === 'success' ? '#86EFAC' : '#FCA5A5'}`,
          padding: '12px 16px', borderRadius: 10, fontSize: '0.9rem', fontWeight: 600, 
          marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 
        }}>
          {toastMsg.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* 5 Stat Cards (Matching Screenshot 1 & 2) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        
        {/* Card 1: Red border card with THÁNG MM/YYYY and bold red hours */}
        <div style={{ 
          background: '#FFFFFF', 
          border: '2px solid #EE0033', 
          borderRadius: 14, 
          padding: '18px 20px', 
          textAlign: 'center', 
          boxShadow: '0 4px 14px rgba(238, 0, 51, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minHeight: 115
        }}>
          <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
            THÁNG {String(currentMonth).padStart(2, '0')}/{currentYear}
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#EE0033', lineHeight: 1.2 }}>
            {stats.total_raw_hours || 0} <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#64748B' }}>giờ OT</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 4, fontWeight: 500 }}>
            Giờ quy đổi: <strong style={{ color: '#0F172A' }}>{stats.total_weighted_hours || 0}h</strong>
          </div>
        </div>

        {/* Card 2: Chờ duyệt */}
        <div style={{ 
          background: '#FFFFFF', 
          border: '1px solid #E2E8F0', 
          borderRadius: 14, 
          padding: '18px 20px', 
          textAlign: 'center', 
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minHeight: 115
        }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#D97706', lineHeight: 1.2 }}>
            {stats.pending_count || 0}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 600, marginTop: 4 }}>
            Chờ duyệt
          </div>
        </div>

        {/* Card 3: Đã duyệt */}
        <div style={{ 
          background: '#FFFFFF', 
          border: '1px solid #E2E8F0', 
          borderRadius: 14, 
          padding: '18px 20px', 
          textAlign: 'center', 
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minHeight: 115
        }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669', lineHeight: 1.2 }}>
            {stats.approved_count || 0}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 600, marginTop: 4 }}>
            Đã duyệt
          </div>
        </div>

        {/* Card 4: Từ chối */}
        <div style={{ 
          background: '#FFFFFF', 
          border: '1px solid #E2E8F0', 
          borderRadius: 14, 
          padding: '18px 20px', 
          textAlign: 'center', 
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minHeight: 115
        }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#DC2626', lineHeight: 1.2 }}>
            {stats.rejected_count || 0}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 600, marginTop: 4 }}>
            Từ chối
          </div>
        </div>

        {/* Card 5: Color Dot Legend */}
        <div style={{ 
          background: '#FFFFFF', 
          border: '1px solid #E2E8F0', 
          borderRadius: 14, 
          padding: '18px 16px', 
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          minHeight: 115
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 600, color: '#1E293B' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669', display: 'inline-block' }}></span>
            <span>Duyệt</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 600, color: '#1E293B' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#D97706', display: 'inline-block' }}></span>
            <span>Chờ</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 600, color: '#1E293B' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#DC2626', display: 'inline-block' }}></span>
            <span>Từ chối</span>
          </div>
        </div>
      </div>

      {/* Monthly Calendar Grid Box */}
      <div className="vt-card" style={{ padding: 24, background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', marginBottom: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.03)' }}>
        
        {/* Navigation Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button 
            onClick={handlePrevMonth}
            style={{ 
              background: '#FFFFFF', 
              border: '1px solid #CBD5E1', 
              borderRadius: 8, 
              width: 36, 
              height: 36, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              cursor: 'pointer',
              color: '#475569',
              transition: 'all 0.15s ease'
            }}
            title="Tháng trước"
          >
            <ChevronLeft size={20} />
          </button>

          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
            Tháng {String(currentMonth).padStart(2, '0')}/{currentYear}
          </h3>

          <button 
            onClick={handleNextMonth}
            style={{ 
              background: '#FFFFFF', 
              border: '1px solid #CBD5E1', 
              borderRadius: 8, 
              width: 36, 
              height: 36, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              cursor: 'pointer',
              color: '#475569',
              transition: 'all 0.15s ease'
            }}
            title="Tháng sau"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Weekday Columns Header (T2 -> CN with T7 & CN in light red) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, textAlign: 'center', fontWeight: 700, fontSize: '0.85rem', marginBottom: 8 }}>
          {['T2', 'T3', 'T4', 'T5', 'T6'].map(d => (
            <div key={d} style={{ padding: '8px 0', background: '#F8FAFC', color: '#475569', borderRadius: 8 }}>
              {d}
            </div>
          ))}
          {['T7', 'CN'].map(d => (
            <div key={d} style={{ padding: '8px 0', background: '#FFF1F2', color: '#EE0033', borderRadius: 8 }}>
              {d}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`offset-${i}`} style={{ minHeight: 90, background: 'transparent' }}></div>
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dObj = new Date(currentYear, currentMonth - 1, dayNum);
            const dow = dObj.getDay();
            const isWeekend = dow === 0 || dow === 6;
            const isToday = today.getFullYear() === currentYear && (today.getMonth() + 1) === currentMonth && today.getDate() === dayNum;

            const dayRecs = dayRecordsMap[dayNum] || [];
            const dayRawHours = dayRecs.reduce((acc, r) => acc + (r.raw_hours || 0), 0);

            return (
              <div 
                key={dayNum}
                onClick={() => handleDayClick(dayNum)}
                style={{ 
                  minHeight: 92, 
                  background: isWeekend ? 'rgba(238, 0, 51, 0.015)' : '#FFFFFF', 
                  border: isToday ? '1.8px solid #EE0033' : '1px solid #E2E8F0', 
                  borderRadius: 10, 
                  padding: '8px 8px 6px 8px', 
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease',
                  boxShadow: isToday ? '0 2px 8px rgba(238,0,51,0.12)' : 'none',
                  position: 'relative'
                }}
                className="vt-cal-day-cell"
                title={`Bấm vào ngày ${dayNum}/${currentMonth}/${currentYear} để đăng ký OT`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ 
                    fontSize: '0.85rem', 
                    fontWeight: 700, 
                    color: isWeekend ? '#EE0033' : '#1E293B',
                    background: isWeekend ? 'transparent' : '#F1F5F9',
                    padding: isWeekend ? '0' : '1px 6px',
                    borderRadius: 4
                  }}>
                    {dayNum}
                  </span>
                </div>

                {dayRawHours > 0 && (
                  <div style={{ textAlign: 'center', fontSize: '1.05rem', fontWeight: 800, color: '#EE0033', margin: 'auto 0', lineHeight: 1 }}>
                    {dayRawHours}h
                  </div>
                )}

                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', minHeight: 8, alignItems: 'center' }}>
                  {dayRecs.map((r, idx) => {
                    const dotColor = r.status === 'Approved' ? '#059669' : r.status === 'Pending' ? '#D97706' : '#DC2626';
                    return (
                      <span 
                        key={idx}
                        style={{ 
                          width: 7, 
                          height: 7, 
                          borderRadius: '50%', 
                          background: dotColor, 
                          display: 'inline-block',
                          boxShadow: `0 0 4px ${dotColor}80`
                        }}
                      ></span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Employee Overtime Records Table */}
      <div className="vt-card" style={{ padding: 24, background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', boxShadow: '0 2px 12px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={18} style={{ color: '#EE0033' }} />
            <span>Danh sách đăng ký OT — Tháng {String(currentMonth).padStart(2, '0')}/{currentYear}</span>
          </h3>

          <button 
            className="vt-btn-primary" 
            onClick={() => handleDayClick(today.getDate())}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <Plus size={16} />
            <span>Đăng ký OT hôm nay</span>
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Ngày</th>
                <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Giờ</th>
                <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'center' }}>Thực tế</th>
                <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'center' }}>Hệ số</th>
                <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Trạng thái</th>
                <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'center' }}>Quy đổi</th>
                <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {records.length > 0 ? (
                records.map((r) => {
                  const isPending = r.status === 'Pending';
                  const isApproved = r.status === 'Approved';
                  const isRejected = r.status === 'Rejected';

                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.1s ease' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: '#1E293B' }}>
                        {r.work_date}
                      </td>

                      <td style={{ padding: '12px 14px', color: '#475569' }}>
                        {r.start_time} – {r.end_time}
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700 }}>
                        {r.raw_hours}h
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{ background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 700 }}>
                          {r.factor}x
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        {isApproved && (
                          <span style={{ background: 'rgba(5, 150, 105, 0.1)', color: '#059669', border: '1px solid rgba(5, 150, 105, 0.3)', padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={13} />
                            Đã duyệt
                          </span>
                        )}
                        {isPending && (
                          <span style={{ background: 'rgba(217, 119, 6, 0.1)', color: '#D97706', border: '1px solid rgba(217, 119, 6, 0.3)', padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={13} />
                            Chờ duyệt
                          </span>
                        )}
                        {isRejected && (
                          <div>
                            <span style={{ background: 'rgba(220, 38, 38, 0.1)', color: '#DC2626', border: '1px solid rgba(220, 38, 38, 0.3)', padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <XCircle size={13} />
                              Từ chối
                            </span>
                            {r.reject_reason && (
                              <div style={{ fontSize: '0.75rem', color: '#DC2626', marginTop: 4, fontStyle: 'italic' }}>
                                Lý do: {r.reject_reason}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 800, color: '#EE0033', fontSize: '0.95rem' }}>
                        {r.weighted_hours}h
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {(isPending || isRejected) && (
                            <>
                              <button 
                                onClick={() => handleEditRecord(r)}
                                style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#475569', padding: '4px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                title="Sửa đăng ký OT"
                              >
                                <Edit2 size={12} />
                                Sửa
                              </button>
                              <button 
                                onClick={() => handleDeleteRecord(r.id)}
                                style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626', padding: '4px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                title="Xóa đăng ký OT"
                              >
                                <Trash2 size={12} />
                                Xóa
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px 20px', color: '#94A3B8' }}>
                    {loading ? 'Đang nạp dữ liệu chấm công OT...' : 'Chưa có đăng ký OT nào trong tháng này.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Modal: Rendered directly via Portal into document.body */}
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.65)', 
            backdropFilter: 'blur(5px)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 999999,
            padding: '16px',
            boxSizing: 'border-box'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              background: '#FFFFFF', 
              borderRadius: 16, 
              width: '100%', 
              maxWidth: 480, 
              boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.35)',
              border: '1px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
              overflow: 'hidden',
              boxSizing: 'border-box'
            }}
          >
            {/* Modal Header */}
            <div style={{ 
              padding: '14px 20px', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              borderBottom: '1px solid #F1F5F9', 
              background: '#FFFFFF',
              flexShrink: 0
            }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                {editId ? 'Sửa đăng ký OT' : 'Đăng ký OT'}
              </h3>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: '#94A3B8', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center',
                  padding: 4,
                  borderRadius: 6,
                  transition: 'all 0.15s ease'
                }}
                title="Đóng cửa sổ"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form Content */}
            <form 
              onSubmit={handleSubmitOT} 
              style={{ 
                padding: '16px 20px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 11, 
                overflowY: 'auto',
                boxSizing: 'border-box'
              }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#1E293B', marginBottom: 4 }}>
                  Ngày
                </label>
                <input 
                  type="text" 
                  readOnly 
                  value={formatModalDate(selectedDate)}
                  style={{ 
                    width: '100%', 
                    padding: '7px 12px', 
                    borderRadius: 8, 
                    border: '1px solid #CBD5E1', 
                    background: '#F1F5F9', 
                    color: '#1E293B', 
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#1E293B', marginBottom: 4 }}>
                    Giờ bắt đầu
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="time" 
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      style={{ 
                        width: '100%', 
                        padding: '7px 10px', 
                        borderRadius: 8, 
                        border: '1px solid #CBD5E1', 
                        background: '#FFFFFF', 
                        color: '#1E293B', 
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#1E293B', marginBottom: 4 }}>
                    Giờ kết thúc
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="time" 
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      placeholder="--:-- --"
                      style={{ 
                        width: '100%', 
                        padding: '7px 10px', 
                        borderRadius: 8, 
                        border: '1px solid #CBD5E1', 
                        background: '#FFFFFF', 
                        color: '#1E293B', 
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                      required
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: -2 }}>
                <input 
                  type="checkbox" 
                  id="ot-is-holiday"
                  checked={isHoliday}
                  onChange={(e) => setIsHoliday(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#EE0033', cursor: 'pointer' }}
                />
                <label htmlFor="ot-is-holiday" style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1E293B', cursor: 'pointer', userSelect: 'none' }}>
                  Ngày lễ / Nghỉ bù <span style={{ color: '#64748B', fontWeight: 500 }}>(hệ số 3.0 / 3.9)</span>
                </label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#1E293B', marginBottom: 4 }}>
                  Lý do OT
                </label>
                <textarea 
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Cú pháp: [Tên QLTT yêu cầu] - [Công việc cụ thể] (Ví dụ: lucnv11 - upcode...)"
                  style={{ 
                    width: '100%', 
                    padding: '8px 12px', 
                    borderRadius: 8, 
                    border: '1px solid #CBD5E1', 
                    background: '#FFFFFF', 
                    color: '#1E293B', 
                    fontSize: '0.84rem',
                    resize: 'none',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {timeWarning && (
                <div style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '6px 10px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={15} />
                  <span>{timeWarning}</span>
                </div>
              )}

              {previewData && (
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '9px 12px', fontSize: '0.78rem' }}>
                  <div style={{ fontWeight: 700, color: '#2563EB', marginBottom: 4 }}>
                    Tính toán giờ quy đổi dự kiến:
                  </div>
                  {previewData.segments?.map((seg, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, color: '#1E293B' }}>
                      <span>{seg.start_time} – {seg.end_time}</span>
                      <span>
                        <strong style={{ color: '#2563EB', background: '#DBEAFE', padding: '1px 5px', borderRadius: 4, marginRight: 5 }}>
                          {seg.factor}x
                        </strong>
                        {seg.raw_hours}h → <strong>{seg.weighted_hours}h quy đổi</strong>
                      </span>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 4, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: '#1E293B' }}>
                    <span>Tổng thực tế: {previewData.total_raw_hours}h</span>
                    <span style={{ color: '#EE0033' }}>Tổng quy đổi: {previewData.total_weighted_hours}h</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 2, paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  style={{ 
                    background: '#64748B', 
                    color: '#FFFFFF', 
                    border: 'none', 
                    borderRadius: 8, 
                    padding: '8px 20px', 
                    fontWeight: 700, 
                    fontSize: '0.88rem', 
                    cursor: 'pointer',
                    transition: 'all 0.15s ease' 
                  }}
                >
                  Hủy
                </button>

                <button 
                  type="submit" 
                  disabled={modalLoading}
                  style={{ 
                    background: '#EE0033', 
                    color: '#FFFFFF', 
                    border: 'none', 
                    borderRadius: 8, 
                    padding: '8px 20px', 
                    fontWeight: 700, 
                    fontSize: '0.88rem', 
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(238,0,51,0.25)',
                    transition: 'all 0.15s ease' 
                  }}
                >
                  {modalLoading ? 'Đang gửi...' : editId ? 'Cập nhật' : 'Đăng ký'}
                </button>
              </div>

            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
