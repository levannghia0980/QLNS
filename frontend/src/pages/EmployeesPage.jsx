import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { UserCheck, Plus, Search, Download, Edit, Trash2, Key, Users, Clock, X, User, Briefcase, Mail, Phone, Shield, Laptop, Building, MapPin } from 'lucide-react';
import axios from 'axios';
import OvertimePage from './OvertimePage';

export default function EmployeesPage() {
  const [subTab, setSubTab] = useState('employees'); // 'employees' | 'accounts' | 'overtime'
  const [employees, setEmployees] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(null);

  const initialForm = {
    employee_code: '',
    full_name: '',
    role: 'user',
    user_type: 'employee',
    gender: 'Nam',
    ethnicity: 'Kinh',
    viettel_email: '',
    birthday: '',
    hometown: '',
    phone: '',
    cccd: '',
    bank_name: 'Viettel Money',
    bank_account: '',
    project: 'Công nghệ thông tin',
    position: 'Chuyên viên',
    position_id: null,
    join_date: '',
    direct_manager: '',
    computer_serial: '',
    employment_status: 'Chính thức',
    use_company_mac: 'Không',
    staff_category: 'NS trung tâm',
    seat_position: '',
    borrow_end_date: '',
    borrow_project: '',
    borrow_pm: '',
    borrow_center: ''
  };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    if (subTab === 'employees') fetchEmployees();
    if (subTab === 'accounts') fetchAccounts();
  }, [subTab]);

  // Completely lock body & html scroll when any modal is open
  useEffect(() => {
    if (isAddOpen || isEditOpen || isDetailOpen) {
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
  }, [isAddOpen, isEditOpen, isDetailOpen]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/employees/');
      if (Array.isArray(res.data)) {
        setEmployees(res.data);
      } else {
        setEmployees([]);
      }
    } catch (err) {
      console.warn('API fetch employees failed:', err);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/admin/accounts?user_type=employee');
      if (Array.isArray(res.data)) {
        setAccounts(res.data);
      } else {
        setAccounts([]);
      }
    } catch (err) {
      console.warn('API accounts fetch failed:', err);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  const safeEmployees = Array.isArray(employees) ? employees : [];
  const safeAccounts = Array.isArray(accounts) ? accounts : [];

  const filteredEmployees = safeEmployees.filter(e => 
    e && (
      (e.full_name && e.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (e.employee_code && e.employee_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (e.project && e.project.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (e.viettel_email && e.viettel_email.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  );

  const filteredAccounts = safeAccounts.filter(a => 
    a && (
      (a.full_name && a.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (a.employee_code && a.employee_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (a.username && a.username.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  );

  // Add Handler
  const handleOpenAdd = () => {
    setFormData(initialForm);
    setIsAddOpen(true);
  };

  const handleSaveAdd = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post('/employees/', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Thêm nhân viên mới thành công!');
      setIsAddOpen(false);
      fetchEmployees();
    } catch (err) {
      alert('Lỗi thêm nhân viên: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Edit Handler
  const handleOpenEdit = (emp, e) => {
    if (e) e.stopPropagation();
    setSelectedEmp(emp);
    setFormData({
      employee_code: emp.employee_code || '',
      full_name: emp.full_name || '',
      role: emp.role || 'user',
      user_type: emp.user_type || 'employee',
      gender: emp.gender || 'Nam',
      ethnicity: emp.ethnicity || 'Kinh',
      viettel_email: emp.viettel_email || emp.email || '',
      birthday: emp.birthday || '',
      hometown: emp.hometown || '',
      phone: emp.phone || '',
      cccd: emp.cccd || '',
      bank_name: emp.bank_name || 'Viettel Money',
      bank_account: emp.bank_account || '',
      project: emp.project || emp.department || 'Công nghệ thông tin',
      position: emp.position || 'Chuyên viên',
      position_id: emp.position_id || null,
      join_date: emp.join_date || '',
      direct_manager: emp.direct_manager || '',
      computer_serial: emp.computer_serial || '',
      employment_status: emp.employment_status || 'Chính thức',
      use_company_mac: emp.use_company_mac || 'Không',
      staff_category: emp.staff_category || 'NS trung tâm',
      seat_position: emp.seat_position || '',
      borrow_end_date: emp.borrow_end_date || '',
      borrow_project: emp.borrow_project || '',
      borrow_pm: emp.borrow_pm || '',
      borrow_center: emp.borrow_center || ''
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedEmp) return;
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/employees/${selectedEmp.id}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Cập nhật thông tin nhân viên thành công!');
      setIsEditOpen(false);
      fetchEmployees();
    } catch (err) {
      alert('Lỗi cập nhật nhân viên: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Delete Handler
  const handleDelete = async (emp, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Bạn có chắc chắn muốn xóa Nhân viên "${emp.full_name}" (${emp.employee_code}) khỏi CSDL?`)) {
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/employees/${emp.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Đã xóa nhân viên thành công!');
      fetchEmployees();
    } catch (err) {
      alert('Lỗi xóa nhân viên: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Row Double Click
  const handleRowDoubleClick = (emp) => {
    setSelectedEmp(emp);
    setIsDetailOpen(true);
  };

  return (
    <div className="vt-container animate-fade-in">
      {/* Top Header Title & Internal Sub-Tabs Navigation */}
      <div className="vt-page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="vt-page-title">Quản lý Nhân sự</h1>
          <p className="vt-page-desc">Quản lý hồ sơ cán bộ nhân viên, tài khoản đăng nhập và tổng hợp làm thêm OT</p>
        </div>

        {subTab === 'employees' && (
          <button className="vt-btn-primary" onClick={handleOpenAdd}>
            <Plus size={16} />
            <span>Thêm Nhân viên</span>
          </button>
        )}
      </div>

      {/* In-Page Sub-Navigation Controls */}
      <div className="vt-sub-nav-bar">
        <button 
          className={`vt-sub-nav-pill ${subTab === 'employees' ? 'active' : ''}`}
          onClick={() => setSubTab('employees')}
        >
          <Users size={16} />
          <span>Danh sách nhân viên ({safeEmployees.length})</span>
        </button>

        <button 
          className={`vt-sub-nav-pill ${subTab === 'accounts' ? 'active' : ''}`}
          onClick={() => setSubTab('accounts')}
        >
          <Key size={16} />
          <span>Tài khoản đăng nhập ({safeAccounts.length})</span>
        </button>

        <button 
          className={`vt-sub-nav-pill ${subTab === 'overtime' ? 'active' : ''}`}
          onClick={() => setSubTab('overtime')}
        >
          <Clock size={16} />
          <span>Quản lý OT</span>
        </button>
      </div>

      {/* Sub-Tab 1: Danh sách Nhân viên */}
      {subTab === 'employees' && (
        <div className="vt-card vt-table-card animate-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div className="vt-search-box" style={{ width: 320 }}>
              <Search size={15} className="vt-search-icon" />
              <input 
                type="text" 
                placeholder="Tìm tên, Mã NV, Email, Dự án..." 
                className="vt-search-input"
                style={{ width: '100%' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <span style={{ fontSize: '0.8rem', color: '#64748B', fontStyle: 'italic' }}>
              💡 Mẹo: Nhấn đúp 2 lần vào hàng để xem đầy đủ hồ sơ chi tiết cán bộ nhân viên
            </span>
          </div>

          <table className="vt-table">
            <thead>
              <tr>
                <th>MÃ NV</th>
                <th>HỌ VÀ TÊN</th>
                <th>EMAIL VIETTEL</th>
                <th>SỐ ĐIỆN THOẠI</th>
                <th>LOẠI NHÂN SỰ</th>
                <th>PHÒNG BAN / DỰ ÁN</th>
                <th style={{ textAlign: 'center' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#EE0033' }}>Đang nạp danh sách nhân viên từ CSDL Backend...</td>
                </tr>
              ) : filteredEmployees.length > 0 ? filteredEmployees.map((emp, idx) => (
                <tr 
                  key={emp.id || idx}
                  onDoubleClick={() => handleRowDoubleClick(emp)}
                  style={{ cursor: 'pointer' }}
                  title="Nhấn đúp chuột để xem chi tiết đầy đủ thông tin nhân viên này"
                >
                  <td style={{ fontWeight: 700, color: '#EE0033' }}>{emp.employee_code || '—'}</td>
                  <td style={{ fontWeight: 600, color: '#0F172A' }}>{emp.full_name || '—'}</td>
                  <td>{emp.viettel_email || emp.email || '—'}</td>
                  <td>{emp.phone || '—'}</td>
                  <td>
                    <span className="vt-badge vt-badge-success">
                      {emp.staff_category || 'NS Trung tâm'}
                    </span>
                  </td>
                  <td>{emp.project || emp.department || 'Công nghệ thông tin'}</td>
                  <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button 
                        title="Sửa thông tin" 
                        onClick={(e) => handleOpenEdit(emp, e)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#2563EB', padding: 4 }}
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        title="Xóa nhân viên" 
                        onClick={(e) => handleDelete(emp, e)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#EE0033', padding: 4 }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#94A3B8' }}>Không tìm thấy nhân viên nào trong CSDL</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Sub-Tab 2: Tài khoản Đăng nhập */}
      {subTab === 'accounts' && (
        <div className="vt-card vt-table-card animate-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div className="vt-search-box" style={{ width: 300 }}>
              <Search size={15} className="vt-search-icon" />
              <input 
                type="text" 
                placeholder="Tìm tài khoản..." 
                className="vt-search-input"
                style={{ width: '100%' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <table className="vt-table">
            <thead>
              <tr>
                <th>MÃ NV</th>
                <th>HỌ VÀ TÊN</th>
                <th>TÊN ĐĂNG NHẬP</th>
                <th>TRẠNG THÁI TÀI KHOẢN</th>
                <th>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#EE0033' }}>Đang nạp tài khoản từ CSDL...</td>
                </tr>
              ) : filteredAccounts.length > 0 ? filteredAccounts.map((acc, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 700, color: '#EE0033' }}>{acc.employee_code || '—'}</td>
                  <td style={{ fontWeight: 600, color: '#0F172A' }}>{acc.full_name || '—'}</td>
                  <td style={{ fontWeight: 600, color: '#2563EB' }}>{acc.username || acc.employee_code || '—'}</td>
                  <td>
                    <span className={`vt-badge ${acc.account_status === 1 ? 'vt-badge-success' : 'vt-badge-danger'}`}>
                      {acc.account_status === 1 ? 'Đang hoạt động' : 'Đã khóa'}
                    </span>
                  </td>
                  <td>
                    <button title="Đặt lại mật khẩu" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#D97706', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Key size={15} />
                      <span style={{ fontSize: '0.8rem' }}>Reset Password</span>
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#94A3B8' }}>Không có tài khoản nhân viên nào trong CSDL</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Sub-Tab 3: Quản lý OT */}
      {subTab === 'overtime' && <OvertimePage />}

      {/* MODAL 1: Detail View Modal via React Portal (Mounted directly under document.body) */}
      {isDetailOpen && selectedEmp && createPortal(
        <div 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0,
            bottom: 0,
            width: '100vw', 
            height: '100vh', 
            backgroundColor: 'rgba(15, 23, 42, 0.75)', 
            backdropFilter: 'blur(4px)',
            zIndex: 999999, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: 20,
            overflow: 'hidden'
          }}
          onClick={() => setIsDetailOpen(false)}
        >
          <div 
            style={{ 
              width: '100%', 
              maxWidth: 680, 
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              background: '#ffffff', 
              borderRadius: 16,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
              overflow: 'hidden',
              zIndex: 1000000,
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ background: '#EE0033', color: 'white', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Users size={22} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'white' }}>
                  Hồ Sơ Chi Tiết Cán Bộ Nhân Viên: {selectedEmp.full_name} ({selectedEmp.employee_code})
                </h3>
              </div>
              <button onClick={() => setIsDetailOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            {/* Modal Scrollable Content */}
            <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, overflowY: 'auto', flex: 1 }}>
              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block' }}>Mã Cán Bộ Nhân Viên</span>
                <strong style={{ color: '#EE0033', fontSize: '1rem' }}>{selectedEmp.employee_code || '—'}</strong>
              </div>

              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block' }}>Họ và Tên Cán Bộ</span>
                <strong style={{ color: '#0F172A', fontSize: '1rem' }}>{selectedEmp.full_name || '—'}</strong>
              </div>

              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block' }}>Email Viettel</span>
                <strong style={{ color: '#2563EB' }}>{selectedEmp.viettel_email || selectedEmp.email || '—'}</strong>
              </div>

              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block' }}>Số Điện Thoại</span>
                <strong>{selectedEmp.phone || '—'}</strong>
              </div>

              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block' }}>Loại Nhân Sự / Vị Trí</span>
                <strong>{selectedEmp.staff_category || 'NS trung tâm'} ({selectedEmp.position || 'Chuyên viên'})</strong>
              </div>

              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block' }}>Phòng Ban / Dự Án</span>
                <strong>{selectedEmp.project || selectedEmp.department || 'Công nghệ thông tin'}</strong>
              </div>

              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block' }}>Quản Lý Trực Tiếp</span>
                <strong>{selectedEmp.direct_manager || '—'}</strong>
              </div>

              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block' }}>Vị Trí Ngồi</span>
                <strong>{selectedEmp.seat_position || '—'}</strong>
              </div>

              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block' }}>Seri Máy Tính / Máy Mac</span>
                <strong>{selectedEmp.computer_serial || '—'} (Dùng Mac: {selectedEmp.use_company_mac || 'Không'})</strong>
              </div>

              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block' }}>Trạng Thái Hợp Đồng</span>
                <span className="vt-badge vt-badge-success">{selectedEmp.employment_status || 'Chính thức'}</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 24px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: 12, flexShrink: 0 }}>
              <button 
                type="button" 
                className="vt-btn-primary" 
                style={{ background: '#2563EB', padding: '8px 20px', cursor: 'pointer' }}
                onClick={() => { setIsDetailOpen(false); handleOpenEdit(selectedEmp); }}
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

      {/* MODAL 2: Add / Edit Form Modal via React Portal */}
      {(isAddOpen || isEditOpen) && createPortal(
        <div 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0,
            bottom: 0,
            width: '100vw', 
            height: '100vh', 
            backgroundColor: 'rgba(15, 23, 42, 0.75)', 
            backdropFilter: 'blur(4px)',
            zIndex: 999999, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: 20,
            overflow: 'hidden'
          }}
          onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }}
        >
          <div 
            style={{ 
              width: '100%', 
              maxWidth: 600, 
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              background: '#ffffff', 
              borderRadius: 16,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
              overflow: 'hidden',
              zIndex: 1000000,
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ background: '#EE0033', color: 'white', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'white' }}>
                {isAddOpen ? 'Thêm Cán Bộ Nhân Viên Mới' : `Chỉnh Sửa Nhân Viên: ${formData.full_name}`}
              </h3>
              <button onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={isAddOpen ? handleSaveAdd : handleSaveEdit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', marginBottom: 4, display: 'block' }}>Mã Nhân Viên (*)</label>
                  <input 
                    type="text" 
                    className="vt-search-input" 
                    style={{ width: '100%' }} 
                    placeholder="VD: NV001"
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
                    placeholder="VD: Nguyễn Văn B"
                    value={formData.full_name} 
                    onChange={e => setFormData({ ...formData, full_name: e.target.value })} 
                    required 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', marginBottom: 4, display: 'block' }}>Email Viettel</label>
                  <input 
                    type="email" 
                    className="vt-search-input" 
                    style={{ width: '100%' }} 
                    placeholder="nvb@viettel.com.vn"
                    value={formData.viettel_email} 
                    onChange={e => setFormData({ ...formData, viettel_email: e.target.value })} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', marginBottom: 4, display: 'block' }}>Số Điện Thoại</label>
                  <input 
                    type="text" 
                    className="vt-search-input" 
                    style={{ width: '100%' }} 
                    placeholder="0987123456"
                    value={formData.phone} 
                    onChange={e => setFormData({ ...formData, phone: e.target.value })} 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', marginBottom: 4, display: 'block' }}>Phòng Ban / Dự Án</label>
                  <input 
                    type="text" 
                    className="vt-search-input" 
                    style={{ width: '100%' }} 
                    placeholder="VD: Trung tâm CNTT..."
                    value={formData.project} 
                    onChange={e => setFormData({ ...formData, project: e.target.value })} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', marginBottom: 4, display: 'block' }}>Loại Nhân Sự</label>
                  <select className="vt-search-input" style={{ width: '100%' }} value={formData.staff_category} onChange={e => setFormData({ ...formData, staff_category: e.target.value })}>
                    <option value="NS trung tâm">NS trung tâm</option>
                    <option value="Onsite">Onsite</option>
                    <option value="Cho mượn">Cho mượn</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', marginBottom: 4, display: 'block' }}>Quản Lý Trực Tiếp</label>
                  <input 
                    type="text" 
                    className="vt-search-input" 
                    style={{ width: '100%' }} 
                    placeholder="Username quản lý"
                    value={formData.direct_manager} 
                    onChange={e => setFormData({ ...formData, direct_manager: e.target.value })} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', marginBottom: 4, display: 'block' }}>Trạng Thái Hợp Đồng</label>
                  <select className="vt-search-input" style={{ width: '100%' }} value={formData.employment_status} onChange={e => setFormData({ ...formData, employment_status: e.target.value })}>
                    <option value="Chính thức">Chính thức</option>
                    <option value="Thử việc">Thử việc</option>
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
    </div>
  );
}
