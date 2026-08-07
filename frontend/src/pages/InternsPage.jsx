import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { GraduationCap, Plus, Search, Upload, Edit, Trash2, Calendar, X, Download, Link2, RefreshCw, Check, AlertCircle } from 'lucide-react';
import axios from 'axios';
import SchedulePage from './SchedulePage';

export default function InternsPage() {
  const [subTab, setSubTab] = useState('interns'); // 'interns' | 'schedule'
  const [interns, setInterns] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [selectedIntern, setSelectedIntern] = useState(null);

  // Google Sheet Link state
  const [savedSheetUrl, setSavedSheetUrl] = useState(() => localStorage.getItem('interns_sheet_url') || '');
  const [tempLinkInput, setTempLinkInput] = useState('');
  const [syncOption, setSyncOption] = useState('link'); // 'link' | 'file'
  const [syncLoading, setSyncLoading] = useState(false);
  const [autoCreateLoading, setAutoCreateLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const fileInputRef = useRef(null);

  const initialForm = {
    employee_code: '',
    full_name: '',
    role: 'user',
    user_type: 'intern',
    gender: 'Nam',
    ethnicity: 'Kinh',
    viettel_email: '',
    birthday: '',
    hometown: '',
    phone: '',
    cccd: '',
    bank_name: 'Viettel Money',
    bank_account: '',
    project: '',
    position: 'TTS',
    allowance: 'Không',
    employee_type: 'TTS Trung tâm',
    working_status: 'Working',
    employment_type: 'Fulltime'
  };
  const [formData, setFormData] = useState(initialForm);

  const calcDuration = (joinDateStr) => {
    if (!joinDateStr) return '—';
    try {
      const join = new Date(joinDateStr);
      if (isNaN(join.getTime())) return '—';
      const now = new Date();
      const diffMs = now - join;
      if (diffMs < 0) return 'Mới vào';
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const months = Math.floor(diffDays / 30);
      const days = diffDays % 30;
      if (months > 0 && days > 0) return `${months} tháng ${days} ngày`;
      if (months > 0) return `${months} tháng`;
      return `${days} ngày`;
    } catch {
      return '—';
    }
  };

  useEffect(() => {
    if (subTab === 'interns') fetchInterns();
  }, [subTab]);

  // Lock body & html scroll when any modal is open
  useEffect(() => {
    if (isAddOpen || isEditOpen || isDetailOpen || isLinkModalOpen || isSyncModalOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isAddOpen, isEditOpen, isDetailOpen, isLinkModalOpen, isSyncModalOpen]);

  const fetchInterns = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/admin/users');
      if (Array.isArray(res.data)) {
        setInterns(res.data);
      } else {
        setInterns([]);
      }
    } catch (err) {
      console.warn('API fetch interns failed:', err);
      setInterns([]);
    } finally {
      setLoading(false);
    }
  };

  // Natural Numerical Sort for Employee Code (TTS1, TTS2... TTS10)
  const naturalSort = (arr) => {
    return [...arr].sort((a, b) => {
      const codeA = a.employee_code || '';
      const codeB = b.employee_code || '';
      const numA = parseInt(codeA.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(codeB.replace(/\D/g, ''), 10) || 0;
      if (numA !== numB) return numA - numB;
      return codeA.localeCompare(codeB);
    });
  };

  const safeInterns = Array.isArray(interns) ? interns : [];
  const filtered = naturalSort(safeInterns.filter(i => 
    i && (
      (i.full_name && i.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (i.employee_code && i.employee_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (i.project && i.project.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  ));

  // Export Excel
  const handleExportExcel = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/admin/users/export', {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Danh_Sach_Thuc_Tap_Sinh.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Lỗi xuất file Excel: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Auto Create Google Sheet for Intern List
  const handleAutoCreateSheet = async () => {
    setAutoCreateLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/admin/users/auto-create-sheet', {
        target_sheet_url: tempLinkInput.trim() || undefined
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.sheet_url) {
        const createdUrl = res.data.sheet_url;
        setTempLinkInput(createdUrl);
        setSavedSheetUrl(createdUrl);
        localStorage.setItem('interns_sheet_url', createdUrl);
        setStatusMsg('🎉 Tự động tạo Google Sheet Danh sách TTS thành công!');
        setTimeout(() => setStatusMsg(''), 5000);
      } else if (res.data?.activation_url) {
        alert(`⚠️ Vui lòng BẬT dịch vụ Google Sheets API trên dự án Google Cloud:\n${res.data.activation_url}`);
        window.open(res.data.activation_url, '_blank');
      } else {
        alert(res.data?.message || 'Chưa thể tạo Google Sheet tự động.');
      }
    } catch (err) {
      alert('Lỗi tự động tạo Google Sheet: ' + (err.response?.data?.detail || err.message));
    } finally {
      setAutoCreateLoading(false);
    }
  };

  // Save Link Sheet Manual
  const handleSaveLink = (e) => {
    e.preventDefault();
    if (!tempLinkInput.trim()) return;
    const url = tempLinkInput.trim();
    localStorage.setItem('interns_sheet_url', url);
    setSavedSheetUrl(url);
    setIsLinkModalOpen(false);
    setStatusMsg('🎉 Đã lưu thành công Link Google Sheet Danh sách TTS!');
    setTimeout(() => setStatusMsg(''), 4000);
  };

  // Sync Intern List (From Link or From File Excel)
  const handleSyncSubmit = async () => {
    setSyncLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (syncOption === 'link') {
        const targetUrl = savedSheetUrl || tempLinkInput;
        if (!targetUrl.trim()) {
          alert('Vui lòng nhập hoặc tạo Link Google Sheet trước!');
          setSyncLoading(false);
          return;
        }
        const res = await axios.post('/admin/users/import-link', { url: targetUrl.trim() }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert(res.data?.message || 'Đồng bộ danh sách TTS thành công!');
        setIsSyncModalOpen(false);
        fetchInterns();
      } else {
        // Option File Excel
        const file = fileInputRef.current?.files[0];
        if (!file) {
          alert('Vui lòng chọn file Excel (.xlsx) để tải lên!');
          setSyncLoading(false);
          return;
        }
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);
        const res = await axios.post('/admin/users/import', formDataUpload, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
        });
        alert(res.data?.message || 'Import danh sách TTS thành công!');
        setIsSyncModalOpen(false);
        fetchInterns();
      }
    } catch (err) {
      alert('Lỗi đồng bộ: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSyncLoading(false);
    }
  };

  // Handle Add Form
  const handleOpenAdd = () => {
    setFormData(initialForm);
    setIsAddOpen(true);
  };

  const handleSaveAdd = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post('/admin/users', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Thêm thực tập sinh thành công!');
      setIsAddOpen(false);
      fetchInterns();
    } catch (err) {
      alert('Lỗi thêm thực tập sinh: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Handle Edit Form
  const handleOpenEdit = (intern, e) => {
    if (e) e.stopPropagation();
    setSelectedIntern(intern);
    setFormData({
      employee_code: intern.employee_code || '',
      full_name: intern.full_name || '',
      role: intern.role || 'user',
      user_type: intern.user_type || 'intern',
      gender: intern.gender || 'Nam',
      ethnicity: intern.ethnicity || 'Kinh',
      viettel_email: intern.viettel_email || '',
      birthday: intern.birthday || '',
      hometown: intern.hometown || '',
      phone: intern.phone || '',
      cccd: intern.cccd || '',
      bank_name: intern.bank_name || '',
      bank_account: intern.bank_account || '',
      project: intern.project || '',
      position: intern.position || 'TTS',
      allowance: intern.allowance || 'Không',
      employee_type: intern.employee_type || 'TTS Trung tâm',
      working_status: intern.working_status || 'Working',
      employment_type: intern.employment_type || 'Fulltime'
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedIntern) return;
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/admin/users/${selectedIntern.id}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Cập nhật thông tin thực tập sinh thành công!');
      setIsEditOpen(false);
      fetchInterns();
    } catch (err) {
      alert('Lỗi cập nhật: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Handle Delete
  const handleDelete = async (intern, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Bạn có chắc chắn muốn xóa Thực tập sinh "${intern.full_name}" (${intern.employee_code}) khỏi CSDL?`)) {
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/admin/users/${intern.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Đã xóa thực tập sinh thành công!');
      fetchInterns();
    } catch (err) {
      alert('Lỗi xóa thực tập sinh: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Handle Row Double Click -> Open Detail Modal
  const handleRowDoubleClick = (intern) => {
    setSelectedIntern(intern);
    setIsDetailOpen(true);
  };

  return (
    <div className="vt-container animate-fade-in">
      {/* Status Notification Toast */}
      {statusMsg && (
        <div style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', padding: '10px 16px', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
          <Check size={18} />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Page Title Header */}
      <div className="vt-page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="vt-page-title">Quản lý Thực tập sinh</h1>
          <p className="vt-page-desc">Danh sách thực tập sinh, đồng bộ Google Sheet & xuất dữ liệu Excel</p>
        </div>
        {subTab === 'interns' && (
          <button className="vt-btn-primary" onClick={handleOpenAdd}>
            <Plus size={16} />
            <span>Thêm Thực tập sinh</span>
          </button>
        )}
      </div>

      {/* Internal Sub-Navigation Controls */}
      <div className="vt-sub-nav-bar">
        <button 
          className={`vt-sub-nav-pill ${subTab === 'interns' ? 'active' : ''}`}
          onClick={() => setSubTab('interns')}
        >
          <GraduationCap size={16} />
          <span>Danh sách Thực tập sinh ({safeInterns.length})</span>
        </button>

        <button 
          className={`vt-sub-nav-pill ${subTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setSubTab('schedule')}
        >
          <Calendar size={16} />
          <span>Bảng lịch làm việc</span>
        </button>
      </div>

      {/* Sub-Tab 1: Danh sách TTS */}
      {subTab === 'interns' && (
        <div className="vt-card vt-table-card animate-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div className="vt-search-box" style={{ width: 300 }}>
              <Search size={15} className="vt-search-icon" />
              <input 
                type="text" 
                placeholder="Tìm tên, Mã TTS, Dự án..." 
                className="vt-search-input"
                style={{ width: '100%' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Action Buttons Bar Styled Identically to SchedulePage */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button 
                className="vt-btn-secondary" 
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: '0.8rem', background: '#F8FAFC', color: '#0F172A', border: '1px solid #CBD5E1', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
                onClick={() => { setTempLinkInput(savedSheetUrl); setIsLinkModalOpen(true); }}
              >
                <Link2 size={14} />
                <span>{savedSheetUrl ? 'Sửa Link Sheet' : 'Tạo Link Sheet'}</span>
              </button>

              <button 
                className="vt-btn-secondary" 
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: '0.8rem', background: '#EFF6FF', color: '#2563EB', border: '1px solid #2563EB', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
                onClick={() => setIsSyncModalOpen(true)}
              >
                <RefreshCw size={14} className={syncLoading ? 'animate-spin' : ''} />
                <span>Đồng Bộ Danh Sách TTS</span>
              </button>

              <button 
                className="vt-btn-primary" 
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#059669', padding: '6px 12px', fontSize: '0.8rem', borderRadius: 6, fontWeight: 600, cursor: 'pointer', border: 'none' }} 
                onClick={handleExportExcel}
              >
                <Download size={14} />
                <span>Xuất Excel</span>
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="vt-table" style={{ fontSize: '0.8rem', minWidth: 1200 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'center', width: 45 }}>STT</th>
                  <th>HỌ VÀ TÊN</th>
                  <th style={{ textAlign: 'center' }}>VỊ TRÍ / ROLE</th>
                  <th style={{ textAlign: 'center' }}>GIỚI TÍNH</th>
                  <th style={{ textAlign: 'center' }}>DÂN TỘC</th>
                  <th>EMAIL VIETTEL</th>
                  <th style={{ textAlign: 'center' }}>NGÀY SINH</th>
                  <th>QUÊ QUÁN</th>
                  <th>SỐ ĐIỆN THOẠI</th>
                  <th>SỐ CCCD</th>
                  <th>SỐ TÀI KHOẢN</th>
                  <th>DỰ ÁN</th>
                  <th style={{ textAlign: 'center' }}>NGÀY VÀO</th>
                  <th style={{ textAlign: 'center' }}>TỔNG TG TT</th>
                  <th style={{ textAlign: 'center' }}>TRẠNG THÁI</th>
                  <th style={{ textAlign: 'center', width: 80 }}>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={16} style={{ textAlign: 'center', padding: 24, color: '#EE0033' }}>
                      Đang nạp danh sách thực tập sinh...
                    </td>
                  </tr>
                ) : filtered.length > 0 ? filtered.map((intern, idx) => {
                  const duration = calcDuration(intern.join_date);
                  return (
                    <tr 
                      key={intern.id || idx}
                      onDoubleClick={() => handleRowDoubleClick(intern)}
                      style={{ cursor: 'pointer' }}
                      title="Nhấn đúp chuột để xem chi tiết đầy đủ thông tin thực tập sinh này"
                    >
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#EE0033' }}>{idx + 1}</td>
                      <td style={{ fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap' }}>{intern.full_name || '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="vt-badge vt-badge-primary" style={{ fontSize: '0.72rem', padding: '2px 6px' }}>{intern.position || intern.role || 'Dev'}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>{intern.gender || 'Nam'}</td>
                      <td style={{ textAlign: 'center' }}>{intern.ethnicity || 'Kinh'}</td>
                      <td style={{ color: '#2563EB', fontSize: '0.75rem' }}>{intern.viettel_email || '—'}</td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {intern.birthday ? new Date(intern.birthday).toLocaleDateString('vi-VN') : '—'}
                      </td>
                      <td>{intern.hometown || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0F172A' }}>{intern.phone || '—'}</td>
                      <td style={{ fontFamily: 'monospace', color: '#475569' }}>{intern.cccd || '—'}</td>
                      <td style={{ fontSize: '0.75rem', color: '#334155' }}>{intern.bank_account || '—'}</td>
                      <td style={{ color: '#059669', fontWeight: 600 }}>{intern.project || '—'}</td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {intern.join_date ? new Date(intern.join_date).toLocaleDateString('vi-VN') : '—'}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: '#D97706', whiteSpace: 'nowrap' }}>
                        {duration}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`vt-badge ${intern.employee_type === 'Người mượn' ? 'vt-badge-warning' : 'vt-badge-success'}`} style={{ fontSize: '0.72rem', padding: '2px 6px' }}>
                          {intern.employee_type || intern.working_status || 'Của công ty'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button 
                            className="vt-btn-icon" 
                            title="Chỉnh sửa thông tin"
                            onClick={(e) => handleOpenEdit(intern, e)}
                            style={{ color: '#2563EB', cursor: 'pointer', border: 'none', background: 'transparent', padding: 2 }}
                          >
                            <Edit size={15} />
                          </button>
                          <button 
                            className="vt-btn-icon text-danger" 
                            title="Xóa thực tập sinh"
                            onClick={(e) => handleDelete(intern, e)}
                            style={{ color: '#EE0033', cursor: 'pointer', border: 'none', background: 'transparent', padding: 2 }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={16} style={{ textAlign: 'center', padding: 24, color: '#94A3B8' }}>
                      Không tìm thấy thực tập sinh nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Bảng lịch làm việc */}
      {subTab === 'schedule' && <SchedulePage />}

      {/* MODAL 1: Detail View Modal */}
      {isDetailOpen && selectedIntern && createPortal(
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflow: 'hidden' }}
          onClick={() => setIsDetailOpen(false)}
        >
          <div 
            style={{ width: '100%', maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: '#ffffff', borderRadius: 16, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)', overflow: 'hidden', zIndex: 1000000, position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ background: '#EE0033', color: 'white', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <GraduationCap size={22} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'white' }}>
                  Hồ Sơ Chi Tiết Thực Tập Sinh: {selectedIntern.full_name} ({selectedIntern.employee_code})
                </h3>
              </div>
              <button onClick={() => setIsDetailOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, overflowY: 'auto', flex: 1 }}>
              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block' }}>Mã Thực Tập Sinh</span>
                <strong style={{ color: '#EE0033', fontSize: '1rem' }}>{selectedIntern.employee_code || '—'}</strong>
              </div>
              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block' }}>Họ và Tên</span>
                <strong style={{ color: '#0F172A', fontSize: '1rem' }}>{selectedIntern.full_name || '—'}</strong>
              </div>
              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block' }}>Dự Án Đang Tham Gia</span>
                <strong style={{ color: '#2563EB' }}>{selectedIntern.project || 'Chưa gán dự án'}</strong>
              </div>
              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block' }}>Số Điện Thoại</span>
                <strong>{selectedIntern.phone || '—'}</strong>
              </div>
              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block' }}>Email Viettel</span>
                <strong>{selectedIntern.viettel_email || '—'}</strong>
              </div>
              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block' }}>Quê Quán</span>
                <strong>{selectedIntern.hometown || '—'}</strong>
              </div>
              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block' }}>Giới Tính / Dân Tộc</span>
                <strong>{selectedIntern.gender || 'Nam'} / {selectedIntern.ethnicity || 'Kinh'}</strong>
              </div>
              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block' }}>Ngày Sinh</span>
                <strong>{selectedIntern.birthday || '—'}</strong>
              </div>
              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block' }}>Số CCCD / CMND</span>
                <strong>{selectedIntern.cccd || '—'}</strong>
              </div>
              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block' }}>Ngân Hàng / STK</span>
                <strong>{selectedIntern.bank_name || '—'} ({selectedIntern.bank_account || '—'})</strong>
              </div>
              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block' }}>Phụ Cấp</span>
                <strong style={{ color: '#059669' }}>{selectedIntern.allowance || 'Không'}</strong>
              </div>
              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block' }}>Trạng Thái Làm Việc</span>
                <span className={`vt-badge ${selectedIntern.working_status === 'Working' ? 'vt-badge-success' : 'vt-badge-warning'}`}>
                  {selectedIntern.working_status || 'Working'}
                </span>
              </div>
            </div>

            <div style={{ padding: '16px 24px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: 12, flexShrink: 0 }}>
              <button 
                type="button" 
                className="vt-btn-primary" 
                style={{ background: '#2563EB', padding: '8px 20px', cursor: 'pointer' }}
                onClick={() => { setIsDetailOpen(false); handleOpenEdit(selectedIntern); }}
              >
                Chỉnh Sửa
              </button>
              <button 
                type="button" 
                className="vt-select-sm" 
                style={{ padding: '8px 20px', cursor: 'pointer' }}
                onClick={() => setIsDetailOpen(false)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 2: Add / Edit Form Modal */}
      {(isAddOpen || isEditOpen) && createPortal(
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflow: 'hidden' }}
          onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }}
        >
          <div 
            style={{ width: '100%', maxWidth: 580, maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: '#ffffff', borderRadius: 16, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)', overflow: 'hidden', zIndex: 1000000, position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ background: '#EE0033', color: 'white', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'white' }}>
                {isAddOpen ? 'Thêm Thực Tập Sinh Mới' : `Chỉnh Sửa Thực Tập Sinh: ${formData.full_name}`}
              </h3>
              <button onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={isAddOpen ? handleSaveAdd : handleSaveEdit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', marginBottom: 4, display: 'block' }}>Mã NV (*)</label>
                  <input 
                    type="text" 
                    className="vt-search-input" 
                    style={{ width: '100%' }} 
                    placeholder="VD: TTS16"
                    value={formData.employee_code} 
                    onChange={e => setFormData({ ...formData, employee_code: e.target.value })} 
                    required 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', marginBottom: 4, display: 'block' }}>Họ và Tên (*)</label>
                  <input 
                    type="text" 
                    className="vt-search-input" 
                    style={{ width: '100%' }} 
                    placeholder="VD: Nguyễn Văn A"
                    value={formData.full_name} 
                    onChange={e => setFormData({ ...formData, full_name: e.target.value })} 
                    required 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', marginBottom: 4, display: 'block' }}>Dự Án</label>
                  <input 
                    type="text" 
                    className="vt-search-input" 
                    style={{ width: '100%' }} 
                    placeholder="VD: Visa, BTTM..."
                    value={formData.project} 
                    onChange={e => setFormData({ ...formData, project: e.target.value })} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', marginBottom: 4, display: 'block' }}>Số Điện Thoại</label>
                  <input 
                    type="text" 
                    className="vt-search-input" 
                    style={{ width: '100%' }} 
                    placeholder="0987654321"
                    value={formData.phone} 
                    onChange={e => setFormData({ ...formData, phone: e.target.value })} 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', marginBottom: 4, display: 'block' }}>Quê Quán</label>
                  <input 
                    type="text" 
                    className="vt-search-input" 
                    style={{ width: '100%' }} 
                    placeholder="Hà Nội, Nam Định..."
                    value={formData.hometown} 
                    onChange={e => setFormData({ ...formData, hometown: e.target.value })} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', marginBottom: 4, display: 'block' }}>Email Viettel</label>
                  <input 
                    type="email" 
                    className="vt-search-input" 
                    style={{ width: '100%' }} 
                    placeholder="anhnv@viettel.com.vn"
                    value={formData.viettel_email} 
                    onChange={e => setFormData({ ...formData, viettel_email: e.target.value })} 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', marginBottom: 4, display: 'block' }}>Giới Tính</label>
                  <select className="vt-search-input" style={{ width: '100%' }} value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })}>
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', marginBottom: 4, display: 'block' }}>Trạng Thái</label>
                  <select className="vt-search-input" style={{ width: '100%' }} value={formData.working_status} onChange={e => setFormData({ ...formData, working_status: e.target.value })}>
                    <option value="Working">Working</option>
                    <option value="Resigned">Resigned</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', marginBottom: 4, display: 'block' }}>Phụ Cấp</label>
                  <select className="vt-search-input" style={{ width: '100%' }} value={formData.allowance} onChange={e => setFormData({ ...formData, allowance: e.target.value })}>
                    <option value="Có">Có</option>
                    <option value="Không">Không</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16, flexShrink: 0 }}>
                <button type="button" className="vt-select-sm" style={{ padding: '8px 20px', cursor: 'pointer' }} onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }}>
                  Hủy
                </button>
                <button type="submit" className="vt-btn-primary" style={{ padding: '8px 24px', cursor: 'pointer' }}>
                  <span>{isAddOpen ? 'Thêm Mới' : 'Lưu Thay Đổi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 3: Configure Google Sheet Link Modal */}
      {isLinkModalOpen && createPortal(
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflow: 'hidden' }}
          onClick={() => setIsLinkModalOpen(false)}
        >
          <div 
            style={{ width: '100%', maxWidth: 540, background: '#ffffff', borderRadius: 16, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)', overflow: 'hidden', zIndex: 1000000, position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ background: '#EE0033', color: 'white', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'white' }}>
                Cấu Hình Google Sheet Danh Sách TTS
              </h3>
              <button onClick={() => setIsLinkModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveLink} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0F172A', marginBottom: 6, display: 'block' }}>
                  Link Google Sheet Danh sách Thực tập sinh (*):
                </label>
                <input 
                  type="url" 
                  className="vt-search-input" 
                  style={{ width: '100%', padding: '10px 14px' }}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={tempLinkInput}
                  onChange={(e) => setTempLinkInput(e.target.value)}
                />
              </div>

              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: 14, borderRadius: 10 }}>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569', lineHeight: 1.5 }}>
                  💡 Bấm nút xanh phía dưới để <strong>Tự Động Tạo Sheet Mới</strong> trong Google Drive. Bạn có thể nhập thêm tên TTS mới lên Sheet mà không cần điền Mã NV ➔ Khi đồng bộ, hệ thống sẽ tự động thêm TTS vào CSDL và tự tăng Mã NV lên!
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                <button 
                  type="button" 
                  className="vt-btn-primary" 
                  style={{ background: '#2563EB', padding: '10px 16px', justifyContent: 'center' }}
                  onClick={handleAutoCreateSheet}
                  disabled={autoCreateLoading}
                >
                  <Link2 size={16} />
                  <span>{autoCreateLoading ? 'Đang tạo Google Sheet...' : '✨ TỰ ĐỘNG TẠO GOOGLE SHEET DANH SÁCH TTS'}</span>
                </button>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button type="button" className="vt-select-sm" onClick={() => setIsLinkModalOpen(false)}>Hủy</button>
                  <button type="submit" className="vt-btn-primary" style={{ padding: '8px 20px' }}>Lưu Link</button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 4: Sync Modal (Google Sheet Link OR Excel File Upload) */}
      {isSyncModalOpen && createPortal(
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflow: 'hidden' }}
          onClick={() => setIsSyncModalOpen(false)}
        >
          <div 
            style={{ width: '100%', maxWidth: 520, background: '#ffffff', borderRadius: 16, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)', overflow: 'hidden', zIndex: 1000000, position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ background: '#EE0033', color: 'white', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'white' }}>
                Đồng Bộ Danh Sách Thực Tập Sinh
              </h3>
              <button onClick={() => setIsSyncModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0F172A', marginBottom: 8, display: 'block' }}>
                  Phương Thức Đồng Bộ Dữ Liệu:
                </label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, color: syncOption === 'link' ? '#EE0033' : '#475569' }}>
                    <input type="radio" name="syncOpt" checked={syncOption === 'link'} onChange={() => setSyncOption('link')} />
                    <span>Đồng bộ từ Google Sheet</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, color: syncOption === 'file' ? '#EE0033' : '#475569' }}>
                    <input type="radio" name="syncOpt" checked={syncOption === 'file'} onChange={() => setSyncOption('file')} />
                    <span>Import File Excel (.xlsx)</span>
                  </label>
                </div>
              </div>

              {syncOption === 'link' ? (
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: 14, borderRadius: 10 }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748B', display: 'block', marginBottom: 4 }}>Link Sheet Đang Dùng:</span>
                  <strong style={{ fontSize: '0.85rem', color: '#2563EB', wordBreak: 'break-all' }}>
                    {savedSheetUrl || 'Chưa lưu link (Vui lòng bấm Tự Tạo Sheet hoặc lưu link trước)'}
                  </strong>
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0F172A', marginBottom: 6, display: 'block' }}>
                    Chọn File Excel Danh Sách TTS (.xlsx):
                  </label>
                  <input type="file" ref={fileInputRef} accept=".xlsx" style={{ width: '100%', padding: 8, border: '1px solid #CBD5E1', borderRadius: 8 }} />
                </div>
              )}

              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', padding: 12, borderRadius: 10 }}>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#1E40AF', lineHeight: 1.5 }}>
                  ✨ <strong>Cơ chế tự tăng Mã NV:</strong> Nếu thêm dòng TTS mới trên Sheet/Excel mà chưa có Mã NV, hệ thống sẽ tự động cấp mã tiếp theo (VD: <code>TTS16</code>, <code>TTS17</code>...) và tự động thêm vào CSDL!
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button type="button" className="vt-select-sm" style={{ padding: '8px 20px', cursor: 'pointer' }} onClick={() => setIsSyncModalOpen(false)}>
                  Hủy
                </button>
                <button type="button" className="vt-btn-primary" style={{ background: '#059669', padding: '8px 24px', cursor: 'pointer' }} onClick={handleSyncSubmit} disabled={syncLoading}>
                  <RefreshCw size={16} />
                  <span>{syncLoading ? 'Đang đồng bộ...' : 'Bắt Đầu Đồng Bộ'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
