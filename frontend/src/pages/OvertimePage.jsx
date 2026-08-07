import React, { useState, useEffect } from 'react';
import { Clock, Plus, CheckCircle, XCircle, ListFilter, Table, Download, Search, CheckCheck, X } from 'lucide-react';
import axios from 'axios';

export default function OvertimePage() {
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'summary'
  const [otList, setOtList] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  // Register Modal State (Dành cho Nhân viên / TTS)
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [workDate, setWorkDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('18:30');
  const [endTime, setEndTime] = useState('21:00');
  const [isHoliday, setIsHoliday] = useState(false);
  const [reason, setReason] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState('');

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('user');
      if (savedUser) setCurrentUser(JSON.parse(savedUser));
    } catch (e) {}
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    if (activeTab === 'list') fetchOvertimeList();
    if (activeTab === 'summary') fetchOvertimeSummary();
  }, [activeTab, month, year]);

  const fetchOvertimeList = async () => {
    setLoading(true);
    try {
      let res;
      if (isAdmin) {
        res = await axios.get(`/overtime/admin/list?month=${month}&year=${year}`);
      } else {
        res = await axios.get(`/overtime/my?month=${month}&year=${year}`);
      }
      if (Array.isArray(res.data)) {
        setOtList(res.data);
      } else {
        setOtList([]);
      }
    } catch (err) {
      console.warn('Overtime list fetch error:', err);
      setOtList([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchOvertimeSummary = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/overtime/admin/summary?month=${month}&year=${year}`);
      setSummaryData(res.data);
    } catch (err) {
      console.warn('Overtime summary fetch error:', err);
      setSummaryData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await axios.post(`/overtime/admin/${id}/approve`);
      setSuccessMsg('Đã duyệt phiếu OT! Dữ liệu đã được tự động cập nhật vào Bảng tổng hợp OT theo tháng.');
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchOvertimeList();
    } catch (err) {
      alert('Lỗi phê duyệt OT: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleApproveAllPending = async () => {
    try {
      await axios.post(`/overtime/admin/approve-all-pending?month=${month}&year=${year}`);
      setSuccessMsg('Đã duyệt toàn bộ phiếu OT Chờ duyệt! Bảng tổng hợp tháng đã được cập nhật CSDL.');
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchOvertimeList();
    } catch (err) {
      alert('Lỗi duyệt tất cả: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleReject = async (id) => {
    const rejectReason = prompt('Nhập lý do từ chối phiếu OT này:');
    if (!rejectReason) return;
    try {
      await axios.post(`/overtime/admin/${id}/reject`, { reject_reason: rejectReason });
      fetchOvertimeList();
    } catch (err) {
      alert('Lỗi từ chối OT: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleCreateOT = async (e) => {
    e.preventDefault();
    setRegisterError('');
    setRegisterLoading(true);
    try {
      await axios.post('/overtime/', {
        work_date: workDate,
        start_time: startTime,
        end_time: endTime,
        is_holiday: isHoliday,
        reason: reason.trim() || null
      });
      setIsRegisterOpen(false);
      setSuccessMsg('Đăng ký OT thành công! Phiếu đã lưu CSDL và chuyển tới Admin ở trạng thái Chờ duyệt.');
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchOvertimeList();
    } catch (err) {
      let msg = 'Lỗi tạo phiếu OT';
      if (err.response?.data?.detail) {
        msg = typeof err.response.data.detail === 'string' ? err.response.data.detail : err.response.data.detail[0]?.msg || msg;
      }
      setRegisterError(msg);
    } finally {
      setRegisterLoading(false);
    }
  };

  // Safe Excel Export with JWT Auth Token
  const handleExportExcel = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/overtime/admin/export?month=${month}&year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Phu_Luc_02_Bao_Cao_OT_Thang_${month}_${year}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Lỗi khi xuất file Excel: ' + (err.response?.data?.detail || err.message));
    }
  };

  const safeList = Array.isArray(otList) ? otList : [];
  const filteredList = safeList.filter(item => 
    !searchTerm ||
    (item.full_name && item.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.employee_code && item.employee_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.project && item.project.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const summaryUsers = Array.isArray(summaryData?.rows) ? summaryData.rows : [];

  return (
    <div className="vt-container animate-fade-in">
      {/* Title & Actions Bar */}
      <div className="vt-page-header">
        <div>
          <h1 className="vt-page-title">
            {isAdmin ? 'Quản lý & Phê Duyệt Overtime (OT)' : 'Chấm Công & Đăng Ký Overtime (OT)'}
          </h1>
          <p className="vt-page-desc">
            {isAdmin 
              ? 'Phê duyệt phiếu OT của nhân viên và theo dõi Bảng tổng hợp công OT theo tháng' 
              : 'Đăng ký giờ làm thêm OT và theo dõi trạng thái phê duyệt từ Quản trị viên'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          {isAdmin && (
            <button className="vt-btn-primary" style={{ background: '#059669' }} onClick={handleExportExcel}>
              <Download size={16} />
              <span>Xuất Excel Phụ Lục 02</span>
            </button>
          )}

          {!isAdmin && (
            <button className="vt-btn-primary" onClick={() => setIsRegisterOpen(true)}>
              <Plus size={16} />
              <span>Tạo Phiếu Đăng Ký OT</span>
            </button>
          )}
        </div>
      </div>

      {successMsg && (
        <div style={{ background: '#DCFCE7', color: '#15803D', padding: '12px 16px', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Internal Sub-Tabs Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div className="vt-sub-nav-bar" style={{ margin: 0 }}>
          <button 
            className={`vt-sub-nav-pill ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            <ListFilter size={16} />
            <span>Danh sách OT chi tiết</span>
          </button>

          {isAdmin && (
            <button 
              className={`vt-sub-nav-pill ${activeTab === 'summary' ? 'active' : ''}`}
              onClick={() => setActiveTab('summary')}
            >
              <Table size={16} />
              <span>Bảng tổng hợp OT theo tháng</span>
            </button>
          )}
        </div>

        {/* Month & Year Filter Controls */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748B' }}>Tháng:</label>
          <select 
            className="vt-select-sm" 
            value={month} 
            onChange={(e) => setMonth(Number(e.target.value))}
            style={{ padding: '6px 12px' }}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
            ))}
          </select>

          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748B' }}>Năm:</label>
          <select 
            className="vt-select-sm" 
            value={year} 
            onChange={(e) => setYear(Number(e.target.value))}
            style={{ padding: '6px 12px' }}
          >
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>
        </div>
      </div>

      {/* Tab 1: Danh sách OT chi tiết */}
      {activeTab === 'list' && (
        <div className="vt-card vt-table-card animate-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12 }}>
            <div className="vt-search-box" style={{ width: 300 }}>
              <Search size={15} className="vt-search-icon" />
              <input 
                type="text" 
                placeholder="Tìm nhân viên hoặc dự án..." 
                className="vt-search-input"
                style={{ width: '100%' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {isAdmin && (
              <button className="vt-btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid #059669', borderRadius: 8, background: '#ECFDF5', color: '#059669', cursor: 'pointer', fontWeight: 600 }} onClick={handleApproveAllPending}>
                <CheckCheck size={16} />
                <span>Duyệt tất cả phiếu Pending</span>
              </button>
            )}
          </div>

          <table className="vt-table">
            <thead>
              <tr>
                <th>MÃ NV</th>
                <th>HỌ VÀ TÊN</th>
                <th>NGÀY LÀM OT</th>
                <th>KHUNG GIỜ</th>
                <th>GIỜ THỰC TẾ</th>
                <th>HỆ SỐ</th>
                <th>GIỜ QUY ĐỔI</th>
                <th>DỰ ÁN</th>
                <th>TRẠNG THÁI</th>
                {isAdmin && <th>THAO TÁC ADM</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 10 : 9} style={{ textAlign: 'center', padding: 24, color: '#EE0033' }}>Đang nạp danh sách OT từ CSDL...</td>
                </tr>
              ) : filteredList.length > 0 ? filteredList.map((item, idx) => (
                <tr key={item.id || idx}>
                  <td style={{ fontWeight: 700, color: '#EE0033' }}>{item.employee_code || item.user_code || '—'}</td>
                  <td style={{ fontWeight: 600, color: '#0F172A' }}>{item.full_name || item.employee_name || '—'}</td>
                  <td>{item.work_date || '—'}</td>
                  <td style={{ fontSize: '0.8rem', color: '#64748B' }}>{item.start_time} - {item.end_time}</td>
                  <td style={{ fontWeight: 600 }}>{item.raw_hours || item.hours || 0}h</td>
                  <td>
                    <span className="vt-badge" style={{ background: '#EFF6FF', color: '#2563EB' }}>
                      {item.factor ? `${item.factor}x` : '1.5x'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, color: '#EE0033' }}>{item.weighted_hours || item.raw_hours || 0}h</td>
                  <td>{item.project || 'Dự án Viettel HRM'}</td>
                  <td>
                    <span className={`vt-badge ${item.status === 'Approved' || item.status === 'Đã duyệt' ? 'vt-badge-success' : item.status === 'Rejected' ? 'vt-badge-danger' : 'vt-badge-warning'}`}>
                      {item.status === 'Approved' ? 'Đã duyệt' : item.status === 'Rejected' ? 'Từ chối' : 'Chờ duyệt'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td>
                      {item.status === 'Pending' || item.status === 'Chờ duyệt' ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => handleApprove(item.id)} title="Duyệt" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#059669' }}><CheckCircle size={18} /></button>
                          <button onClick={() => handleReject(item.id)} title="Từ chối" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#EE0033' }}><XCircle size={18} /></button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Hoàn tất</span>
                      )}
                    </td>
                  )}
                </tr>
              )) : (
                <tr>
                  <td colSpan={isAdmin ? 10 : 9} style={{ textAlign: 'center', padding: 24, color: '#94A3B8' }}>Chưa có phiếu làm thêm OT nào trong tháng này</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Bảng Tổng Hợp OT Theo Tháng (Admin View) */}
      {activeTab === 'summary' && isAdmin && (
        <div className="vt-card vt-table-card animate-fade-in">
          <div style={{ padding: '16px 20px', background: '#F8FAFC', borderBottom: '1px solid var(--vt-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#0F172A' }}>
              Bảng Tổng Hợp Giờ Làm Thêm OT Đã Duyệt Tháng {month}/{year}
            </h3>
            <span style={{ fontSize: '0.85rem', color: '#64748B' }}>
              Tổng nhân viên có OT: <strong>{summaryUsers.length}</strong> người
            </span>
          </div>

          <table className="vt-table">
            <thead>
              <tr>
                <th>MÃ NV</th>
                <th>HỌ VÀ TÊN</th>
                <th>DỰ ÁN</th>
                <th>GIỜ THỰC TẾ (RAW)</th>
                <th>1.5x (≤22h)</th>
                <th>2.1x (&gt;22h)</th>
                <th>2.0x (T7,CN)</th>
                <th>2.7x (&gt;22h T7,CN)</th>
                <th>3.0x (Lễ)</th>
                <th>TỔNG QUY ĐỔI</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 24, color: '#EE0033' }}>Đang nạp dữ liệu tổng hợp từ CSDL...</td>
                </tr>
              ) : summaryUsers.length > 0 ? summaryUsers.map((u, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 700, color: '#EE0033' }}>{u.employee_code || '—'}</td>
                  <td style={{ fontWeight: 600, color: '#0F172A' }}>{u.full_name || '—'}</td>
                  <td>{u.project || 'Dự án Viettel'}</td>
                  <td style={{ fontWeight: 600 }}>{u.total_raw || 0} giờ</td>
                  <td>{u.total_by_factor?.['1.5'] || 0}h</td>
                  <td>{u.total_by_factor?.['2.1'] || 0}h</td>
                  <td>{u.total_by_factor?.['2.0'] || 0}h</td>
                  <td>{u.total_by_factor?.['2.7'] || 0}h</td>
                  <td>{u.total_by_factor?.['3.0'] || 0}h</td>
                  <td style={{ fontWeight: 800, color: '#EE0033', fontSize: '0.95rem' }}>
                    {u.total_weighted || 0} giờ
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 24, color: '#94A3B8' }}>Chưa có phiếu OT nào được Admin duyệt trong tháng {month}/{year}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Đăng Ký OT (Chỉ dành cho Giao diện Nhân viên / TTS) */}
      {!isAdmin && isRegisterOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyCenter: 'center', padding: 20 }}>
          <div className="vt-card animate-fade-in" style={{ width: '100%', maxWidth: 480, padding: 0, overflow: 'hidden' }}>
            <div style={{ background: '#EE0033', color: 'white', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'white' }}>Tạo Phiếu Đăng Ký OT</h3>
              <button onClick={() => setIsRegisterOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateOT} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {registerError && (
                <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem' }}>
                  {registerError}
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B', marginBottom: 4, display: 'block' }}>Ngày làm OT (*)</label>
                <input type="date" className="vt-search-input" style={{ width: '100%' }} value={workDate} onChange={e => setWorkDate(e.target.value)} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B', marginBottom: 4, display: 'block' }}>Giờ bắt đầu (*)</label>
                  <input type="time" className="vt-search-input" style={{ width: '100%' }} value={startTime} onChange={e => setStartTime(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B', marginBottom: 4, display: 'block' }}>Giờ kết thúc (*)</label>
                  <input type="time" className="vt-search-input" style={{ width: '100%' }} value={endTime} onChange={e => setEndTime(e.target.value)} required />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="chk-holiday" checked={isHoliday} onChange={e => setIsHoliday(e.target.checked)} />
                <label htmlFor="chk-holiday" style={{ fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}>Làm thêm vào Ngày Lễ / Tết</label>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B', marginBottom: 4, display: 'block' }}>Lý do làm OT / Nội dung công việc</label>
                <textarea className="vt-search-input" style={{ width: '100%', height: 80, padding: 10 }} placeholder="Nhập chi tiết nội dung công việc OT..." value={reason} onChange={e => setReason(e.target.value)} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" className="vt-select-sm" style={{ padding: '8px 16px', cursor: 'pointer' }} onClick={() => setIsRegisterOpen(false)}>Hủy</button>
                <button type="submit" className="vt-btn-primary" disabled={registerLoading}>
                  <span>{registerLoading ? 'Đang gửi CSDL...' : 'Gửi Đăng Ký OT'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
