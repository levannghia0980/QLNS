import React, { useState, useEffect, useRef } from 'react';
import { Download, Search, Upload, Link as LinkIcon, RefreshCw, CheckCircle, AlertCircle, X, ExternalLink, Sparkles, Copy } from 'lucide-react';
import axios from 'axios';

export default function SchedulePage() {
  const [scheduleData, setScheduleData] = useState(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Link Sheet Storage & Modals
  const [savedSheetUrl, setSavedSheetUrl] = useState(() => localStorage.getItem('schedule_sheet_url') || '');
  const [isCreateLinkOpen, setIsCreateLinkOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [tempLinkInput, setTempLinkInput] = useState('');
  const [syncOption, setSyncOption] = useState('link'); // 'link' | 'file'
  const [syncLoading, setSyncLoading] = useState(false);
  const [autoCreateLoading, setAutoCreateLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchSchedule();
    const monthKey = `schedule_sheet_url_${month}_${year}`;
    const urlForMonth = localStorage.getItem(monthKey) || '';
    setSavedSheetUrl(urlForMonth);
    setTempLinkInput(urlForMonth);
  }, [month, year]);

  const fetchSchedule = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/admin/schedule?month=${month}&year=${year}`);
      setScheduleData(res.data);
    } catch (err) {
      console.warn('Fetch schedule error:', err);
      setScheduleData(null);
    } finally {
      setLoading(false);
    }
  };

  // 1. Export Excel
  const handleExportExcel = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/admin/schedule/export?month=${month}&year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bang_Lich_Thuc_Tap_Thang_${month}_${year}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Lỗi xuất file Excel: ' + (err.response?.data?.detail || err.message));
    }
  };

  // 2. 1-Click Auto Create Google Sheet directly inside Admin's Google Drive
  const handleAutoCreateGoogleSheet = async (forceNew = false) => {
    setAutoCreateLoading(true);
    setErrorMsg('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/admin/schedule/auto-create-sheet', {
        month: month,
        year: year,
        target_sheet_url: forceNew ? undefined : (tempLinkInput.trim() || undefined),
        force_new: forceNew
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success && res.data?.sheet_url) {
        const createdUrl = res.data.sheet_url;
        setTempLinkInput(createdUrl);
        setSavedSheetUrl(createdUrl);
        const monthKey = `schedule_sheet_url_${month}_${year}`;
        localStorage.setItem(monthKey, createdUrl);
        localStorage.setItem('schedule_sheet_url', createdUrl);
        setStatusMsg(`🎉 Tự động tạo Google Sheet cho Tháng ${month}/${year} thành công!`);
        setTimeout(() => setStatusMsg(''), 6000);
      } else if (res.data?.activation_url) {
        alert(`⚠️ Vui lòng BẬT dịch vụ Google Sheets API trên dự án Google Cloud:\n${res.data.activation_url}`);
        window.open(res.data.activation_url, '_blank');
      } else {
        alert(res.data?.message || 'Chưa thể tạo Google Sheet tự động.');
      }
    } catch (err) {
      alert('Lỗi tự tạo Google Sheet: ' + (err.response?.data?.detail || err.message));
    } finally {
      setAutoCreateLoading(false);
    }
  };

  const handleClearLink = () => {
    setTempLinkInput('');
    setSavedSheetUrl('');
    const monthKey = `schedule_sheet_url_${month}_${year}`;
    localStorage.removeItem(monthKey);
    localStorage.removeItem('schedule_sheet_url');
    setStatusMsg(`🧹 Đã xóa Link Sheet Tháng ${month}/${year} khỏi bộ nhớ!`);
    setTimeout(() => setStatusMsg(''), 4000);
  };

  // 3. Save Manual Link Sheet
  const handleSaveLink = (e) => {
    e.preventDefault();
    if (!tempLinkInput.trim()) return;
    const url = tempLinkInput.trim();
    const monthKey = `schedule_sheet_url_${month}_${year}`;
    localStorage.setItem(monthKey, url);
    localStorage.setItem('schedule_sheet_url', url);
    setSavedSheetUrl(url);
    setIsCreateLinkOpen(false);
    setStatusMsg(`🎉 Đã lưu thành công Link Google Sheets cho Tháng ${month}/${year}!`);
    setTimeout(() => setStatusMsg(''), 4000);
  };

  // Copy link to clipboard
  const handleCopyLink = () => {
    if (!tempLinkInput && !savedSheetUrl) return;
    const linkToCopy = tempLinkInput || savedSheetUrl;
    navigator.clipboard?.writeText(linkToCopy);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  // 4. Sync from Active Link Sheet directly into DB & Reload Web
  const handleSyncFromLink = async () => {
    const activeUrl = tempLinkInput.trim() || savedSheetUrl;
    if (!activeUrl) {
      alert('Chưa tạo Link Sheet! Vui lòng bấm "Tạo Link Sheet" để tự động sinh Google Sheet.');
      return;
    }
    setSyncLoading(true);
    setErrorMsg('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/admin/schedule/import-link', {
        url: activeUrl,
        month: month,
        year: year
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsSyncModalOpen(false);
      setStatusMsg(res.data?.message || 'Đồng bộ lịch từ Google Sheets thành công!');
      setTimeout(() => setStatusMsg(''), 4000);
      
      // Reload table directly from DB to show updated shifts on Web UI immediately!
      fetchSchedule();
    } catch (err) {
      alert('Lỗi đồng bộ từ Link Sheet: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSyncLoading(false);
    }
  };

  // 5. Sync from File Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setSyncLoading(true);
    setErrorMsg('');

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`/admin/schedule/import?month=${month}&year=${year}`, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });
      setIsSyncModalOpen(false);
      setStatusMsg(res.data?.message || 'Đồng bộ lịch từ file Excel thành công!');
      setTimeout(() => setStatusMsg(''), 4000);
      fetchSchedule();
    } catch (err) {
      alert('Lỗi đồng bộ từ File Excel: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSyncLoading(false);
      e.target.value = '';
    }
  };

  const rows = Array.isArray(scheduleData?.rows) ? scheduleData.rows : [];
  const period = scheduleData?.period;

  const numDays = new Date(year, month, 0).getDate();
  const daysArray = Array.from({ length: numDays }, (_, i) => i + 1);

  const filteredRows = rows.filter(row => 
    !searchTerm ||
    (row.full_name && row.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (row.employee_code && row.employee_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (row.project && row.project.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const pad2 = (n) => String(n).padStart(2, '0');

  const getRowShift = (row, day) => {
    const dateStr = `${year}-${pad2(month)}-${pad2(day)}`;
    const match = (row.schedules || []).find(s => s.work_day === dateStr);
    return match ? match.shift : '';
  };

  const getRowTotalShifts = (row) => {
    let total = 0;
    (row.schedules || []).forEach(s => {
      if (s.shift === 'SC') total += 1;
      else if (s.shift === 'S' || s.shift === 'C') total += 0.5;
    });
    return total;
  };

  return (
    <div className="vt-container animate-fade-in" style={{ maxWidth: '100%', padding: '0 16px' }}>
      {/* Header Bar */}
      <div className="vt-page-header" style={{ marginBottom: 14 }}>
        <div>
          <h1 className="vt-page-title" style={{ fontSize: '1.25rem' }}>Bảng Lịch Làm Việc Thực Tập Sinh</h1>
          <p className="vt-page-desc" style={{ fontSize: '0.8rem' }}>Theo dõi ca sáng (S), ca chiều (C), hoặc cả ngày (SC) trong tháng</p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* Button 1: Tạo / Sửa Link Sheet */}
          <button 
            className="vt-btn-secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: '0.8rem', background: '#F8FAFC', color: '#0F172A', border: '1px solid #CBD5E1', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
            onClick={() => { setTempLinkInput(savedSheetUrl); setIsCreateLinkOpen(true); }}
          >
            <LinkIcon size={14} />
            <span>{savedSheetUrl ? 'Sửa Link Sheet' : 'Tạo Link Sheet'}</span>
          </button>

          {/* Button 2: Đồng bộ */}
          <button 
            className="vt-btn-secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: '0.8rem', background: '#EFF6FF', color: '#2563EB', border: '1px solid #2563EB', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
            onClick={() => setIsSyncModalOpen(true)}
          >
            <RefreshCw size={14} className={syncLoading ? 'animate-spin' : ''} />
            <span>{syncLoading ? 'Đang đọc...' : 'Đồng Bộ Lịch'}</span>
          </button>

          {/* Button 3: Xuất Excel */}
          <button className="vt-btn-primary" style={{ background: '#059669', padding: '6px 12px', fontSize: '0.8rem' }} onClick={handleExportExcel}>
            <Download size={14} />
            <span>Xuất Excel</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div style={{ background: '#DCFCE7', color: '#15803D', padding: '8px 14px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={16} />
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '8px 14px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Table Card (Single Viewport Fit) */}
      <div className="vt-card vt-table-card" style={{ padding: '12px', width: '100%', overflow: 'hidden' }}>
        {/* Controls Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 }}>
          <div className="vt-search-box" style={{ width: 260 }}>
            <Search size={14} className="vt-search-icon" />
            <input 
              type="text" 
              placeholder="Tìm tên, mã TTS, dự án..." 
              className="vt-search-input"
              style={{ width: '100%', padding: '6px 10px 6px 30px', fontSize: '0.8rem' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>Tháng:</label>
            <select 
              className="vt-select-sm" 
              value={month} 
              onChange={(e) => setMonth(Number(e.target.value))}
              style={{ padding: '4px 8px', fontSize: '0.8rem' }}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>Tháng {i + 1}/{year}</option>
              ))}
            </select>
            {period && (
              <span className={`vt-badge ${period.status === 'open' ? 'vt-badge-success' : 'vt-badge-warning'}`} style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                {period.status === 'open' ? 'Mở' : 'Đóng'}
              </span>
            )}
          </div>
        </div>

        {/* Schedule Table Grid */}
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table className="vt-table" style={{ fontSize: '0.72rem', width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: 65, padding: '6px 2px', fontSize: '0.7rem' }}>MNV</th>
                <th style={{ width: 110, padding: '6px 2px', fontSize: '0.7rem' }}>HỌ VÀ TÊN</th>
                <th style={{ width: 75, padding: '6px 2px', fontSize: '0.7rem' }}>DỰ ÁN</th>
                {daysArray.map(d => (
                  <th key={d} style={{ textAlign: 'center', padding: '6px 1px', fontSize: '0.68rem' }}>
                    {d}
                  </th>
                ))}
                <th style={{ width: 55, textAlign: 'center', padding: '6px 2px', fontSize: '0.7rem' }}>TỔNG</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={numDays + 4} style={{ textAlign: 'center', padding: 24, color: '#EE0033' }}>
                    Đang nạp bảng lịch làm việc...
                  </td>
                </tr>
              ) : filteredRows.length > 0 ? filteredRows.map((row, idx) => {
                const totalShifts = getRowTotalShifts(row);
                return (
                  <tr key={row.user_id || idx}>
                    <td style={{ fontWeight: 700, color: '#EE0033', padding: '4px 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.employee_code || '—'}</td>
                    <td style={{ fontWeight: 600, color: '#0F172A', padding: '4px 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.full_name}>{row.full_name || '—'}</td>
                    <td style={{ color: '#64748B', padding: '4px 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.project}>{row.project || '—'}</td>
                    {daysArray.map(d => {
                      const shift = getRowShift(row, d);
                      return (
                        <td key={d} style={{ textAlign: 'center', padding: '4px 0px' }}>
                          {shift === 'SC' ? (
                            <span style={{ background: '#DCFCE7', color: '#15803D', borderRadius: 3, padding: '1px 2px', fontSize: '0.65rem', fontWeight: 700, display: 'inline-block', minWidth: 16 }}>SC</span>
                          ) : shift === 'S' ? (
                            <span style={{ background: '#FEF3C7', color: '#B45309', borderRadius: 3, padding: '1px 2px', fontSize: '0.65rem', fontWeight: 700, display: 'inline-block', minWidth: 16 }}>S</span>
                          ) : shift === 'C' ? (
                            <span style={{ background: '#DBEAFE', color: '#1D4ED8', borderRadius: 3, padding: '1px 2px', fontSize: '0.65rem', fontWeight: 700, display: 'inline-block', minWidth: 16 }}>C</span>
                          ) : (
                            <span style={{ color: '#CBD5E1', fontSize: '0.65rem' }}>·</span>
                          )}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'center', fontWeight: 800, color: '#EE0033', fontSize: '0.75rem', padding: '4px 2px' }}>
                      {totalShifts > 0 ? `${totalShifts}` : '—'}
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={numDays + 4} style={{ textAlign: 'center', padding: 24, color: '#94A3B8' }}>
                    Chưa có thực tập sinh nào đăng ký lịch làm việc trong tháng {month}/{year}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Tạo & Dán Link Google Sheets */}
      {isCreateLinkOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="vt-card animate-fade-in" style={{ width: '100%', maxWidth: 540, padding: 0, overflow: 'hidden' }}>
            <div style={{ background: '#EE0033', color: 'white', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'white' }}>Cấu Hình Link Google Sheets</h3>
              <button onClick={() => setIsCreateLinkOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleSaveLink} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* 1-Click Auto Create Section */}
              <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 10, padding: 16, textAlign: 'center' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#166534', marginTop: 0, marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Sparkles size={16} color="#16A34A" />
                  <span>Tự động sinh Google Sheet bằng Tài khoản Google của bạn:</span>
                </h4>
                <p style={{ fontSize: '0.78rem', color: '#15803D', margin: '0 0 12px 0', lineHeight: 1.4 }}>
                  Tự động khởi tạo file Google Sheet chứa sẵn dữ liệu thực tập sinh từ CSDL vào Google Drive cá nhân của bạn!
                </p>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button 
                    type="button" 
                    className="vt-btn-primary" 
                    style={{ background: '#16A34A', padding: '10px 16px', fontSize: '0.85rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                    onClick={() => handleAutoCreateGoogleSheet(false)}
                    disabled={autoCreateLoading}
                  >
                    <Sparkles size={16} />
                    <span>{autoCreateLoading ? 'Đang tạo...' : `CẬP NHẬT SHEET HIỆN TẠI (THÁNG ${month}/${year})`}</span>
                  </button>

                  <button 
                    type="button" 
                    className="vt-btn-primary" 
                    style={{ background: '#2563EB', padding: '10px 16px', fontSize: '0.85rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                    onClick={() => handleAutoCreateGoogleSheet(true)}
                    disabled={autoCreateLoading}
                    title="Tạo mới hoàn toàn 1 file Google Sheet mới và hủy liên kết file cũ"
                  >
                    <RefreshCw size={16} />
                    <span>TẠO FILE GOOGLE SHEET MỚI TINH</span>
                  </button>
                </div>
              </div>

              {/* Created / Active Link Display */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', margin: 0 }}>
                    Link Google Sheets hiện tại (*):
                  </label>
                  {(tempLinkInput || savedSheetUrl) && (
                    <button
                      type="button"
                      onClick={handleClearLink}
                      style={{ background: 'transparent', border: 'none', color: '#EE0033', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Xóa Link Cũ Này
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <input 
                    type="url" 
                    className="vt-search-input" 
                    style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem' }} 
                    placeholder="https://docs.google.com/spreadsheets/d/..." 
                    value={tempLinkInput} 
                    onChange={e => setTempLinkInput(e.target.value)} 
                    required 
                  />

                  {(tempLinkInput || savedSheetUrl) && (
                    <>
                      <button 
                        type="button" 
                        style={{ background: copiedLink ? '#DCFCE7' : '#EFF6FF', border: '1px solid #93C5FD', color: copiedLink ? '#15803D' : '#1D4ED8', padding: '8px 12px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={handleCopyLink}
                        title="Sao chép Link chia sẻ"
                      >
                        <Copy size={14} />
                        <span>{copiedLink ? 'Đã chép!' : 'Chép Link'}</span>
                      </button>

                      <a 
                        href={tempLinkInput || savedSheetUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', color: '#047857', padding: '8px 12px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                        title="Mở Google Sheets"
                      >
                        <ExternalLink size={14} />
                        <span>Mở Sheet</span>
                      </a>
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button type="button" className="vt-select-sm" style={{ padding: '6px 14px', cursor: 'pointer' }} onClick={() => setIsCreateLinkOpen(false)}>Hủy</button>
                <button type="submit" className="vt-btn-primary" style={{ padding: '6px 16px' }}>
                  <span>Lưu Link Sheet CSDL</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Đồng Bộ Lịch */}
      {isSyncModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="vt-card animate-fade-in" style={{ width: '100%', maxWidth: 520, padding: 0, overflow: 'hidden' }}>
            <div style={{ background: '#0F172A', color: 'white', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'white' }}>Chọn Phương Thức Đồng Bộ Lịch</h3>
              <button onClick={() => setIsSyncModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Option 1: Đồng bộ theo Link đã tạo */}
              <div 
                style={{ 
                  padding: 16, 
                  borderRadius: 8, 
                  border: syncOption === 'link' ? '2px solid #2563EB' : '1px solid #CBD5E1', 
                  background: syncOption === 'link' ? '#EFF6FF' : '#F8FAFC',
                  cursor: 'pointer'
                }}
                onClick={() => setSyncOption('link')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <input type="radio" checked={syncOption === 'link'} onChange={() => setSyncOption('link')} />
                  <strong style={{ fontSize: '0.9rem', color: '#0F172A' }}>Lựa chọn 1: Đồng bộ từ Google Sheet đã sinh</strong>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#64748B', margin: 0, paddingLeft: 24 }}>
                  {savedSheetUrl ? `Link: ${savedSheetUrl.substring(0, 46)}...` : '⚠️ Chưa tạo Link Sheet! Bấm "Tự Động Tạo Google Sheet" trước.'}
                </p>
              </div>

              {/* Option 2: Đồng bộ theo File Excel Upload */}
              <div 
                style={{ 
                  padding: 16, 
                  borderRadius: 8, 
                  border: syncOption === 'file' ? '2px solid #059669' : '1px solid #CBD5E1', 
                  background: syncOption === 'file' ? '#ECFDF5' : '#F8FAFC',
                  cursor: 'pointer'
                }}
                onClick={() => setSyncOption('file')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <input type="radio" checked={syncOption === 'file'} onChange={() => setSyncOption('file')} />
                  <strong style={{ fontSize: '0.9rem', color: '#0F172A' }}>Lựa chọn 2: Đồng bộ từ File Excel upload (.xlsx)</strong>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#64748B', margin: 0, paddingLeft: 24 }}>
                  Tải file Excel từ máy tính của bạn lên để đồng bộ CSDL.
                </p>
              </div>

              <input 
                type="file" 
                ref={fileInputRef} 
                accept=".xlsx" 
                style={{ display: 'none' }} 
                onChange={handleFileUpload} 
              />

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" className="vt-select-sm" style={{ padding: '8px 16px', cursor: 'pointer' }} onClick={() => setIsSyncModalOpen(false)}>Hủy</button>
                
                {syncOption === 'link' ? (
                  <button 
                    type="button" 
                    className="vt-btn-primary" 
                    style={{ background: '#2563EB', padding: '8px 16px' }}
                    onClick={handleSyncFromLink}
                    disabled={syncLoading || !savedSheetUrl}
                  >
                    <span>{syncLoading ? 'Đang đọc Google Sheet...' : 'Đồng bộ từ Google Sheet'}</span>
                  </button>
                ) : (
                  <button 
                    type="button" 
                    className="vt-btn-primary" 
                    style={{ background: '#059669', padding: '8px 16px' }}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={syncLoading}
                  >
                    <span>{syncLoading ? 'Đang đọc File Excel...' : 'Chọn File Excel'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
