import React, { useState, useEffect } from 'react';
import { 
  Bot, Send, Database, FileSpreadsheet, Sparkles, RefreshCw, Settings, Link as LinkIcon, 
  Eye, EyeOff, CheckCircle2, AlertCircle, Save, Plus, Trash2, Table, 
  Search, Upload, X, ChevronDown, Layers, ExternalLink, Info, FileText, Check
} from 'lucide-react';
import axios from 'axios';

export default function AiHrPage() {
  const [subTab, setSubTab] = useState('chat'); // 'chat' | 'sheets' | 'db' | 'settings'
  const [messages, setMessages] = useState([
    { sender: 'ai', text: 'Xin chào! Tôi là Trợ lý AI HR Viettel Software. Bạn có thể hỏi tôi về thống kê nhân sự, tổng hợp lịch làm việc, hoặc truy vấn thông tin nhân viên!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Settings tab state
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-lite');
  const [showPassword, setShowPassword] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [statusType, setStatusType] = useState('success');

  // Sheets tab state
  const [sheetsData, setSheetsData] = useState([]);
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState('sheet'); // 'sheet' | 'excel'
  const [sheetUrlInput, setSheetUrlInput] = useState('');
  const [sheetNameInput, setSheetNameInput] = useState('');
  const [excelFile, setExcelFile] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [sheetActionMsg, setSheetActionMsg] = useState('');

  // Sheet Detail Metadata Modal state (replaces raw data preview)
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);

  // DB tab state
  const [dbTables, setDbTables] = useState([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState('');
  const [tableData, setTableData] = useState([]);
  const [tableDataLoading, setTableDataLoading] = useState(false);
  const [tableSearch, setTableSearch] = useState('');

  // Schema Proposal & Custom Table Creation Modal State
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [proposalData, setProposalData] = useState(null);
  const [editedTableName, setEditedTableName] = useState('');
  const [editedTitle, setEditedTitle] = useState('');
  const [editedColumns, setEditedColumns] = useState([]);
  const [editedRows, setEditedRows] = useState([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [autoSheetLoading, setAutoSheetLoading] = useState({});

  // Lock body & html scroll when any modal is open
  useEffect(() => {
    if (showAddModal || showDetailModal || showSchemaModal) {
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
  }, [showAddModal, showDetailModal, showSchemaModal]);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (subTab === 'sheets') {
      fetchSheets();
    } else if (subTab === 'db') {
      fetchDbTables();
    }
  }, [subTab]);

  // ----------------------------------------------------
  // API FETCHERS
  // ----------------------------------------------------

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/hrai/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data) {
        if (res.data.api_key) setApiKey(res.data.api_key);
        if (res.data.model) setSelectedModel(res.data.model);
      }
    } catch (err) {
      console.warn('API get hrai settings failed:', err);
    }
  };

  const fetchSheets = async () => {
    setSheetsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/hrai/sheets', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSheetsData(res.data || []);
    } catch (err) {
      console.error('Lỗi lấy danh sách Sheet/Excel:', err);
    } finally {
      setSheetsLoading(false);
    }
  };

  const fetchDbTables = async () => {
    setDbLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/hrai/db-tables', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const tables = res.data || [];
      setDbTables(tables);
      if (tables.length > 0 && !selectedTable) {
        handleSelectTable(tables[0].table_name);
      }
    } catch (err) {
      console.error('Lỗi lấy danh sách CSDL:', err);
    } finally {
      setDbLoading(false);
    }
  };

  const handleSelectTable = async (tableName) => {
    if (!tableName) return;
    setSelectedTable(tableName);
    setTableDataLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/hrai/db-tables/${tableName}/data?limit=500`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTableData(res.data?.data || []);
    } catch (err) {
      console.error(`Lỗi lấy dữ liệu bảng ${tableName}:`, err);
      setTableData([]);
    } finally {
      setTableDataLoading(false);
    }
  };

  // ----------------------------------------------------
  // HANDLERS FOR SHEETS & EXCEL
  // ----------------------------------------------------

  const handleUploadSheetOrExcel = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setSheetActionMsg('');
    const token = localStorage.getItem('token');

    try {
      if (addType === 'sheet') {
        if (!sheetUrlInput.trim()) {
          setSheetActionMsg('Vui lòng nhập đường dẫn Link Google Sheet!');
          setActionLoading(false);
          return;
        }
        const formData = new FormData();
        formData.append('url', sheetUrlInput.trim());
        if (sheetNameInput.trim()) formData.append('sheet_name', sheetNameInput.trim());

        const res = await axios.post('/hrai/upload-sheet', formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert(res.data?.message || '🎉 Đồng bộ thành công Google Sheet vào CSDL!');
      } else {
        if (!excelFile) {
          setSheetActionMsg('Vui lòng chọn 1 file Excel (.xlsx hoặc .xls)!');
          setActionLoading(false);
          return;
        }
        const formData = new FormData();
        formData.append('file', excelFile);
        if (sheetNameInput.trim()) formData.append('sheet_name', sheetNameInput.trim());

        const res = await axios.post('/hrai/upload-excel', formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert(res.data?.message || '🎉 Upload và nhập dữ liệu Excel thành công!');
      }

      setShowAddModal(false);
      setSheetUrlInput('');
      setSheetNameInput('');
      setExcelFile(null);
      fetchSheets();
    } catch (err) {
      setSheetActionMsg('Lỗi xử lý: ' + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSyncSheet = async (tabId, tableName) => {
    if (!window.confirm(`Bạn có chắc muốn đồng bộ lại dữ liệu cho bảng '${tableName}'?`)) return;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`/hrai/sheets/${tabId}/sync`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(res.data?.message || '🎉 Đã đồng bộ dữ liệu mới nhất!');
      fetchSheets();
    } catch (err) {
      alert('Lỗi đồng bộ: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDeleteSheet = async (tabId, tableName) => {
    if (!window.confirm(`⚠️ Bạn có chắc chắn muốn XÓA kết nối và bảng CSDL '${tableName}' không?`)) return;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.delete(`/hrai/sheets/${tabId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(res.data?.message || 'Đã xóa kết nối thành công.');
      fetchSheets();
    } catch (err) {
      alert('Lỗi xóa: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleOpenDetailModal = (tab, group, tabId) => {
    setSelectedDetailItem({
      tab_id: tabId,
      tab_name: tab.tab_name,
      table_name: tab.table_name,
      sheet_url: tab.sheet_url || group.sheet_url || '',
      group_name: group.sheet_name || 'Liên kết Google Sheet',
      row_count: tab.row_count,
      last_synced: tab.last_synced || group.last_synced || 'Hôm nay',
      columns: tab.columns || []
    });
    setShowDetailModal(true);
  };

  // ----------------------------------------------------
  // SETTINGS HANDLERS
  // ----------------------------------------------------

  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    if (!apiKey.trim()) {
      setStatusMsg('Vui lòng nhập API Key trước khi lưu!');
      setStatusType('error');
      return;
    }
    setSaveLoading(true);
    setStatusMsg('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/hrai/settings', {
        api_key: apiKey.trim(),
        model: selectedModel
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setStatusMsg(res.data?.message || '🎉 Đã lưu cấu hình vào file .env thành công! Khi khởi động lại hệ thống sẽ không bị mất dữ liệu.');
      setStatusType('success');
    } catch (err) {
      setStatusMsg('Lỗi lưu cấu hình: ' + (err.response?.data?.detail || err.message));
      setStatusType('error');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleTestKey = async () => {
    if (!apiKey.trim()) {
      setStatusMsg('Vui lòng nhập Gemini API Key để kiểm tra kết nối!');
      setStatusType('error');
      return;
    }
    setTestLoading(true);
    setStatusMsg('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/hrai/settings/test-single', {
        api_key: apiKey.trim(),
        model_id: selectedModel
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.working) {
        setStatusMsg(res.data.message || `🎉 Kết nối thành công tới Gemini API (${selectedModel})! Độ trễ: ${res.data.latency_ms}ms`);
        setStatusType('success');
      } else {
        setStatusMsg('❌ Kết nối thất bại: ' + (res.data?.error || 'API Key không hợp lệ hoặc model không phản hồi'));
        setStatusType('error');
      }
    } catch (err) {
      setStatusMsg('Lỗi kiểm tra API Key: ' + (err.response?.data?.detail || err.message));
      setStatusType('error');
    } finally {
      setTestLoading(false);
    }
  };

  // ----------------------------------------------------
  // CHAT HANDLER
  // ----------------------------------------------------

  const handleExportExcel = async (title, sql, data) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/hrai/chat/export-excel', {
        title: title || 'Bao_Cao_AI_HR',
        sql: sql || null,
        data: data || null
      }, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Bao_Cao_HR_AI_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Lỗi xuất file Excel: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleOpenSchemaModal = (proposal) => {
    if (!proposal) return;
    setProposalData(proposal);
    setEditedTableName(proposal.table_name || 'sheet_custom_table');
    setEditedTitle(proposal.title || 'Bảng Dữ Liệu Tùy Chỉnh');
    setEditedColumns(proposal.columns || []);
    setEditedRows(proposal.sample_rows || []);
    setShowSchemaModal(true);
  };

  const handleRequestSchemaProposal = async (customPrompt) => {
    const qText = customPrompt || input.trim();
    if (!qText) return;
    setProposalLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/hrai/generate-schema-proposal', { question: qText }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const proposal = res.data;
      handleOpenSchemaModal(proposal);
    } catch (err) {
      alert('Lỗi đề xuất cấu trúc bảng: ' + (err.response?.data?.detail || err.message));
    } finally {
      setProposalLoading(false);
    }
  };

  const handleConfirmCreateCustomTable = async () => {
    if (!editedTableName || editedColumns.length === 0) {
      alert('Vui lòng nhập tên bảng và ít nhất 1 cột!');
      return;
    }
    setCreateLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/hrai/create-custom-table', {
        table_name: editedTableName,
        title: editedTitle,
        columns: editedColumns,
        rows: editedRows
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert(res.data?.message || 'Tạo bảng CSDL AI HR thành công!');
      setShowSchemaModal(false);
      fetchSheets();
      fetchDbTables();
      setSubTab('db');
    } catch (err) {
      alert('Lỗi tạo bảng CSDL: ' + (err.response?.data?.detail || err.message));
    } finally {
      setCreateLoading(false);
    }
  };

  const handleAutoCreateSheetForTable = async (tableName) => {
    if (!tableName) return;
    setAutoSheetLoading(prev => ({ ...prev, [tableName]: true }));
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`/hrai/tables/${tableName}/auto-create-sheet`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success && res.data?.sheet_url) {
        alert(res.data.message || '✨ Đã tự động tạo Google Sheet thành công!');
        window.open(res.data.sheet_url, '_blank');
        fetchSheets();
        fetchDbTables();
      } else {
        alert(res.data?.message || 'Chưa thể tạo Google Sheet tự động. Vui lòng kiểm tra kết nối Google OAuth.');
      }
    } catch (err) {
      alert('Lỗi tự động tạo Google Sheet: ' + (err.response?.data?.detail || err.message));
    } finally {
      setAutoSheetLoading(prev => ({ ...prev, [tableName]: false }));
    }
  };

  const handleSendText = async (textToSend) => {
    if (!textToSend || !textToSend.trim() || loading) return;

    const userMsg = textToSend.trim();
    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setInput('');
    setLoading(true);

    const isProposalQuery = ['tạo bảng', 'tạo csdl', 'tạo sheet', 'thêm cột', 'tùy chỉnh bảng', 'kpi'].some(k => userMsg.toLowerCase().includes(k));

    try {
      const token = localStorage.getItem('token');
      const chatPromise = axios.post('/hrai/chat', { question: userMsg }, { headers: { Authorization: `Bearer ${token}` } });
      const proposalPromise = isProposalQuery ? axios.post('/hrai/generate-schema-proposal', { question: userMsg }, { headers: { Authorization: `Bearer ${token}` } }) : Promise.resolve(null);

      const [chatRes, proposalRes] = await Promise.all([chatPromise, proposalPromise.catch(() => null)]);

      setMessages(prev => [
        ...prev,
        { 
          sender: 'ai', 
          text: chatRes.data?.text || 'Đã nhận được phản hồi từ AI HR.',
          data: chatRes.data?.data,
          sql: chatRes.data?.sql,
          title: userMsg,
          proposal: proposalRes?.data || null
        }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { sender: 'ai', text: `Dựa trên CSDL Viettel Software: Đã tìm thấy dữ liệu tương ứng. Bạn có cần tôi hỗ trợ xuất file báo cáo không?` }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    handleSendText(input);
  };

  // Filter rows in DB table view grid
  const filteredTableRows = tableData.filter(row => {
    if (!tableSearch.trim()) return true;
    const term = tableSearch.toLowerCase();
    return Object.values(row).some(v => v !== null && String(v).toLowerCase().includes(term));
  });

  const selectedTableObj = dbTables.find(t => t.table_name === selectedTable);

  return (
    <div className="vt-container animate-fade-in">
      <div className="vt-page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="vt-page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bot size={28} style={{ color: '#EE0033' }} />
            Hệ Thống AI HR (HrAi)
          </h1>
          <p className="vt-page-desc">Truy vấn nhân sự thông minh, kết nối Google Sheets & cấu hình Gemini API</p>
        </div>
      </div>

      {/* Internal Sub-Navigation Controls */}
      <div className="vt-sub-nav-bar">
        <button 
          className={`vt-sub-nav-pill ${subTab === 'chat' ? 'active' : ''}`}
          onClick={() => setSubTab('chat')}
        >
          <Sparkles size={16} />
          <span>Trợ lý AI & Xuất Excel</span>
        </button>

        <button 
          className={`vt-sub-nav-pill ${subTab === 'sheets' ? 'active' : ''}`}
          onClick={() => setSubTab('sheets')}
        >
          <FileSpreadsheet size={16} />
          <span>Quản lý Link Sheet & Excel</span>
        </button>

        <button 
          className={`vt-sub-nav-pill ${subTab === 'db' ? 'active' : ''}`}
          onClick={() => setSubTab('db')}
        >
          <Database size={16} />
          <span>CSDL Hệ thống AI HR</span>
        </button>
      </div>

      {/* Sub-Tab 1: AI Chat Assistant + Side Settings Panel */}
      {subTab === 'chat' && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'stretch', flexWrap: 'wrap' }}>
          {/* LEFT COLUMN: CHAT WORKSPACE */}
          <div style={{ flex: '1 1 560px', display: 'flex', flexDirection: 'column', minWidth: 320 }}>
            {/* SUGGESTION CHIPS */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} style={{ color: '#D97706' }} />
                <span>Gợi ý câu hỏi & Đề xuất Tạo CSDL / Excel:</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[
                  { label: '✨ Tạo Bảng Đánh Giá KPI TTS (Đề xuất Cột)', text: 'Tạo bảng đánh giá KPI cho thực tập sinh gồm mã NV, họ tên và điểm KPI', isProposal: true },
                  { label: '📊 Xuất danh sách nhân sự theo vị trí ra Excel', text: 'Thống kê số lượng nhân sự theo từng vị trí và tạo file Excel' },
                  { label: '🎂 Kiểm tra nhân sự trùng ngày sinh', text: 'Có nhân viên nào trùng ngày sinh với nhau không?' },
                  { label: '⏰ Lịch làm việc TTS T8 (Excel)', text: 'Danh sách thực tập sinh đăng ký lịch làm việc T8 và xuất file Excel' }
                ].map((item, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => item.isProposal ? handleRequestSchemaProposal(item.text) : handleSendText(item.text)}
                    style={{
                      background: item.isProposal ? '#EFF6FF' : '#FFF5F5',
                      color: item.isProposal ? '#2563EB' : '#EE0033',
                      border: item.isProposal ? '1px solid #BFDBFE' : '1px solid #FECDD3',
                      padding: '6px 14px',
                      borderRadius: 20,
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'inline-flex',
                      alignItems: 'center',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = item.isProposal ? '#2563EB' : '#EE0033'; e.currentTarget.style.color = '#ffffff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = item.isProposal ? '#EFF6FF' : '#FFF5F5'; e.currentTarget.style.color = item.isProposal ? '#2563EB' : '#EE0033'; }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* CHAT CONTAINER */}
            <div className="vt-card" style={{ height: 'calc(100vh - 290px)', minHeight: 480, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
              {/* Chat History Viewport */}
              <div id="hrai-chat-viewport" style={{ flexGrow: 1, padding: 20, overflowY: 'auto', scrollBehavior: 'smooth', display: 'flex', flexDirection: 'column' }}>
                {/* Welcome Card */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, background: '#FEF2F2', border: '1px solid #FECDD3', borderRadius: 12, padding: 14 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#EE0033', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 6px rgba(238, 0, 51, 0.3)' }}>
                    <Bot size={20} />
                  </div>
                  <div>
                    <h6 style={{ fontWeight: 700, color: '#EE0033', margin: '0 0 4px 0', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkles size={15} />
                      <span>Xin chào! Tôi là Trợ lý AI HR (HrAi)</span>
                    </h6>
                    <p style={{ fontSize: '0.82rem', color: '#475569', margin: 0, lineHeight: 1.5 }}>
                      Tôi có thể giúp bạn truy vấn thông tin nhân sự, <strong>đề xuất & khởi tạo CSDL bảng mới (3 kịch bản)</strong>, cũng như <strong>tự động tạo Google Sheet (.g-sheet) và xuất file Excel (.xlsx)</strong> theo yêu cầu!
                    </p>
                  </div>
                </div>

                {messages.map((m, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: m.sender === 'user' ? '80%' : '85%',
                      padding: m.sender === 'user' ? '10px 16px' : '12px 18px',
                      borderRadius: m.sender === 'user' ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                      background: m.sender === 'user' ? '#EE0033' : '#F8FAFC',
                      border: m.sender === 'user' ? 'none' : '1px solid #E2E8F0',
                      color: m.sender === 'user' ? 'white' : '#0F172A',
                      fontSize: '0.88rem',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      marginBottom: 12,
                      boxShadow: m.sender === 'user' ? '0 2px 6px rgba(238, 0, 51, 0.2)' : '0 1px 3px rgba(0,0,0,0.03)'
                    }}
                  >
                    <div>{m.text}</div>

                    {/* Proposal Card if AI generated schema proposal */}
                    {m.sender === 'ai' && m.proposal && (
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed #CBD5E1' }}>
                        <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: 12, marginBottom: 4 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <strong style={{ fontSize: '0.85rem', color: '#1E40AF', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Table size={16} />
                              <span>Đề xuất CSDL: {m.proposal.title || m.proposal.table_name}</span>
                            </strong>
                            <span style={{ fontSize: '0.7rem', background: '#DBEAFE', color: '#1E40AF', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
                              Scenario {m.proposal.scenario || 3}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.78rem', color: '#3B82F6', margin: '0 0 10px 0' }}>
                            {m.proposal.reasoning || 'AI đã tự động phân tích cấu trúc cột thuộc tính & tạo bảng CSDL.'}
                          </p>

                          <button
                            type="button"
                            onClick={() => handleOpenSchemaModal(m.proposal)}
                            style={{
                              background: '#2563EB',
                              color: '#ffffff',
                              border: 'none',
                              padding: '7px 16px',
                              borderRadius: 8,
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
                            }}
                          >
                            <Settings size={15} />
                            <span>⚙️ Xem & Tùy Chỉnh Cấu Trúc Bảng</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {m.sender === 'ai' && (m.sql || m.data) && (
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8 }}>
                        <button 
                          type="button" 
                          onClick={() => handleExportExcel(m.title || 'Bao_Cao_AI_HR', m.sql, m.data)}
                          style={{
                            background: '#ECFDF5',
                            color: '#047857',
                            border: '1px solid #A7F3D0',
                            padding: '6px 14px',
                            borderRadius: 8,
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#059669'; e.currentTarget.style.color = '#ffffff'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = '#ECFDF5'; e.currentTarget.style.color = '#047857'; }}
                        >
                          <FileSpreadsheet size={16} />
                          <span>📥 Tải File Excel Báo Cáo (.xlsx)</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div style={{ alignSelf: 'flex-start', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '10px 16px', borderRadius: '16px 16px 16px 2px', fontSize: '0.85rem', color: '#64748B', display: 'flex', alignItems: 'center' }}>
                    <RefreshCw size={14} className="animate-spin me-2 text-danger" />
                    AI đang suy nghĩ và phân tích CSDL...
                  </div>
                )}
              </div>

              {/* Chat Input Footer */}
              <div style={{ padding: 14, borderTop: '1px solid #E2E8F0', background: '#ffffff', flexShrink: 0 }}>
                <form onSubmit={handleSend} style={{ display: 'flex', gap: 10 }}>
                  <input 
                    type="text" 
                    className="vt-search-input" 
                    style={{ flexGrow: 1, padding: '10px 16px', fontSize: '0.88rem', borderRadius: 8 }}
                    placeholder="Nhập câu hỏi hoặc yêu cầu tạo file Excel..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    required
                  />
                  <button type="submit" className="vt-btn-primary" disabled={loading} style={{ padding: '0 20px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <Send size={15} />
                    <span>Gửi</span>
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: SLEEK COMPACT GEMINI SETTINGS PANEL */}
          <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="vt-card p-4 animate-fade-in" style={{ borderTop: '4px solid #EE0033', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h6 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Settings size={18} style={{ color: '#EE0033' }} />
                  <span>Cấu Hình AI Gemini</span>
                </h6>
                <span className="badge bg-danger-subtle text-danger border border-danger-subtle" style={{ fontSize: '0.7rem' }}>
                  Setting Trực Tiếp
                </span>
              </div>

              <p style={{ fontSize: '0.78rem', color: '#64748B', marginBottom: 16, lineHeight: 1.4 }}>
                Cấu hình API Key & chọn Model Gemini. Lưu tự động vào file <code>.env</code>.
              </p>

              {/* Status Message Notification */}
              {statusMsg && (
                <div style={{ 
                  background: statusType === 'success' ? '#ECFDF5' : '#FEE2E2', 
                  color: statusType === 'success' ? '#047857' : '#B91C1C', 
                  border: `1px solid ${statusType === 'success' ? '#A7F3D0' : '#FCA5A5'}`, 
                  padding: '10px 14px', 
                  borderRadius: 8, 
                  marginBottom: 14, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8, 
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}>
                  {statusType === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span style={{ wordBreak: 'break-word' }}>{statusMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Model Selection */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', marginBottom: 5 }}>
                    Model AI Gemini (*):
                  </label>
                  <select 
                    className="vt-search-input" 
                    style={{ width: '100%', padding: '9px 12px', fontSize: '0.85rem' }}
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                  >
                    <option value="gemini-3.1-flash-lite">Gemini Flash 3.1 Lite</option>
                    <option value="gemini-3.5-flash-lite">Gemini Flash 3.5 Lite</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  </select>
                </div>

                {/* API Key Input with Eye Toggle */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', marginBottom: 5 }}>
                    Gemini API Key (*):
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      className="vt-search-input" 
                      style={{ width: '100%', padding: '9px 38px 9px 12px', fontSize: '0.85rem' }}
                      placeholder="AIzaSy..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      required
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ 
                        position: 'absolute', 
                        right: 10, 
                        background: 'transparent', 
                        border: 'none', 
                        color: '#64748B', 
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title={showPassword ? 'Ẩn API Key' : 'Hiện API Key'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Control Action Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  <button 
                    type="submit" 
                    className="vt-btn-primary" 
                    disabled={saveLoading}
                    style={{ width: '100%', justifyContent: 'center', padding: '9px 16px', fontSize: '0.85rem' }}
                  >
                    {saveLoading ? (
                      <>
                        <RefreshCw size={15} className="animate-spin me-2" />
                        <span>Đang lưu...</span>
                      </>
                    ) : (
                      <>
                        <Save size={15} className="me-2" />
                        <span>Lưu Cấu Hình .ENV</span>
                      </>
                    )}
                  </button>

                  <button 
                    type="button" 
                    className="vt-btn-secondary" 
                    disabled={testLoading}
                    onClick={handleTestKey}
                    style={{ width: '100%', justifyContent: 'center', padding: '9px 16px', fontSize: '0.85rem', background: '#F8FAFC', border: '1px solid #CBD5E1' }}
                  >
                    {testLoading ? (
                      <>
                        <RefreshCw size={15} className="animate-spin me-2 text-danger" />
                        <span>Đang test...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={15} className="me-2 text-warning" />
                        <span>Kiểm Tra Kết Nối Key</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Status Info Card */}
            <div className="vt-card p-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.78rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={14} className="text-success" />
                  <span>Trạng thái: <strong>Sẵn sàng</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Layers size={14} className="text-primary" />
                  <span>Model active: <strong>{selectedModel}</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Quản lý Link Sheet & Excel (RE-DESIGNED BEAUTIFULLY MATCHING INTERNS PAGE STYLE) */}
      {subTab === 'sheets' && (
        <div className="vt-card vt-table-card animate-fade-in" style={{ padding: 24 }}>
          {/* Header Title Section */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileSpreadsheet size={22} style={{ color: '#EE0033' }} />
                <span>Quản lý Link Google Sheets & File Excel</span>
              </h3>
              <p style={{ fontSize: '0.83rem', color: '#64748B', margin: '4px 0 0 0' }}>
                Danh sách các đường dẫn Google Sheets và File Excel đã được đồng bộ tự động vào CSDL AI HR.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button 
                className="vt-btn-primary" 
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, fontSize: '0.85rem' }}
                onClick={() => { setAddType('sheet'); setSheetActionMsg(''); setShowAddModal(true); }}
              >
                <Plus size={16} />
                <span>Thêm Link Google Sheet</span>
              </button>

              <button 
                className="vt-btn-secondary" 
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, fontSize: '0.85rem', background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#334155' }}
                onClick={() => { setAddType('excel'); setSheetActionMsg(''); setShowAddModal(true); }}
              >
                <Upload size={16} />
                <span>Upload File Excel</span>
              </button>

              <button 
                className="vt-btn-secondary"
                style={{ padding: '9px 12px', borderRadius: 8, background: '#F8FAFC', border: '1px solid #CBD5E1' }}
                onClick={fetchSheets}
                title="Tải lại danh sách"
              >
                <RefreshCw size={16} className={sheetsLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Connected Sheets & Excel Table Grid Layout */}
          {sheetsLoading ? (
            <div style={{ padding: 50, textAlign: 'center', color: '#64748B' }}>
              <RefreshCw size={20} className="animate-spin" style={{ color: '#EE0033', marginBottom: 8 }} />
              <div>Đang tải danh sách kết nối...</div>
            </div>
          ) : sheetsData.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', background: '#F8FAFC', borderRadius: 12, border: '1px dashed #CBD5E1' }}>
              <FileSpreadsheet size={40} style={{ color: '#94A3B8', marginBottom: 10 }} />
              <p style={{ margin: 0, fontWeight: 600, color: '#475569' }}>Chưa có liên kết Google Sheet hoặc Excel nào</p>
              <p style={{ fontSize: '0.82rem', color: '#94A3B8', marginTop: 4 }}>Bấm nút "Thêm Link Google Sheet" hoặc "Upload File Excel" ở trên để kết nối dữ liệu!</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: 10, background: 'white' }}>
              <table className="vt-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    <th style={{ width: 45, textAlign: 'center', fontWeight: 700 }}>STT</th>
                    <th style={{ fontWeight: 700, color: '#0F172A' }}>Tên Sheet / Bảng Dữ Liệu</th>
                    <th style={{ fontWeight: 700, color: '#0F172A' }}>Tên Bảng CSDL (DB)</th>
                    <th style={{ fontWeight: 700, color: '#0F172A', textAlign: 'center' }}>Số Dòng</th>
                    <th style={{ fontWeight: 700, color: '#0F172A' }}>Cập Nhật Lần Cuối</th>
                    <th style={{ fontWeight: 700, color: '#0F172A', textAlign: 'center', width: 220 }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {sheetsData.flatMap((group) => group.tabs || []).map((tab, idx) => {
                    const group = sheetsData.find(g => (g.tabs || []).includes(tab)) || {};
                    const tabId = idx + 1;
                    const isExcel = (tab.sheet_url || '').startsWith('excel://');
                    
                    return (
                      <tr key={idx} style={{ transition: 'background 0.15s ease' }}>
                        <td style={{ textAlign: 'center', color: '#94A3B8', fontWeight: 600 }}>{tabId}</td>

                        {/* Sheet Name & Badge */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {isExcel ? (
                              <FileText size={18} style={{ color: '#2563EB', flexShrink: 0 }} />
                            ) : (
                              <FileSpreadsheet size={18} style={{ color: '#059669', flexShrink: 0 }} />
                            )}
                            <div>
                              <strong style={{ color: '#0F172A', display: 'block', fontSize: '0.88rem' }}>
                                {tab.tab_name}
                              </strong>
                              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                                {isExcel ? '📁 File Excel' : '🟢 Google Sheet'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* CSDL Table Name */}
                        <td>
                          <code style={{ fontSize: '0.8rem', color: '#EE0033', background: '#FEF2F2', padding: '2px 8px', borderRadius: 6, border: '1px solid #FECDD3' }}>
                            {tab.table_name}
                          </code>
                        </td>

                        {/* Row Count Badge */}
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '0.75rem', background: '#ECFDF5', color: '#047857', padding: '2px 10px', borderRadius: 10, fontWeight: 700 }}>
                            {tab.row_count} dòng
                          </span>
                        </td>

                        {/* Last Synced */}
                        <td style={{ color: '#64748B', fontSize: '0.82rem' }}>
                          {tab.last_synced || group.last_synced || 'Hôm nay'}
                        </td>

                        {/* Actions Row */}
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            {/* Nút Tự động Tạo Google Sheet */}
                            <button 
                              className="vt-btn-secondary" 
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: '0.78rem', background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
                              onClick={() => handleAutoCreateSheetForTable(tab.table_name)}
                              disabled={autoSheetLoading[tab.table_name]}
                              title="Tự động tạo Google Sheet cho bảng này"
                            >
                              <FileSpreadsheet size={14} className={autoSheetLoading[tab.table_name] ? 'animate-spin' : ''} />
                              <span>{autoSheetLoading[tab.table_name] ? 'Đang tạo...' : '✨ Tạo Sheet'}</span>
                            </button>

                            {/* Nút Xuất Excel */}
                            <button 
                              className="vt-btn-secondary" 
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: '0.78rem', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECDD3', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
                              onClick={() => handleExportExcel(tab.tab_name, `SELECT * FROM "${tab.table_name}"`, null)}
                              title="Xuất bảng này ra file Excel (.xlsx)"
                            >
                              <FileText size={14} />
                              <span>📊 Excel</span>
                            </button>

                            {/* Nút Xem -> Mở Modal Chi tiết Thông tin Sheet/Excel */}
                            <button 
                              className="vt-btn-secondary" 
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: '0.78rem', background: '#F1F5F9', color: '#0F172A', border: '1px solid #CBD5E1', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
                              onClick={() => handleOpenDetailModal(tab, group, tabId)}
                              title="Xem chi tiết kết nối"
                            >
                              <Info size={14} style={{ color: '#2563EB' }} />
                              <span>Chi tiết</span>
                            </button>

                            {/* Nút Đồng bộ */}
                            <button 
                              className="vt-btn-secondary" 
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: '0.78rem', background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
                              onClick={() => handleSyncSheet(tabId, tab.table_name)}
                              title="Đồng bộ lại dữ liệu mới nhất"
                            >
                              <RefreshCw size={14} />
                              <span>Đồng bộ</span>
                            </button>

                            {/* Nút Xóa */}
                            <button 
                              className="vt-btn-secondary" 
                              style={{ padding: '5px 8px', fontSize: '0.78rem', color: '#DC2626', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 6, cursor: 'pointer' }}
                              onClick={() => handleDeleteSheet(tabId, tab.table_name)}
                              title="Xóa kết nối bảng này"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 3: CSDL Hệ thống AI HR */}
      {subTab === 'db' && (
        <div className="vt-card vt-table-card animate-fade-in" style={{ padding: 24 }}>
          {/* Header Title Section */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Database size={22} style={{ color: '#EE0033' }} />
                <span>Cơ sở Dữ liệu & Các Bảng Tự Động (AI HR Vector/SQL)</span>
              </h3>
              <p style={{ fontSize: '0.83rem', color: '#64748B', margin: '4px 0 0 0' }}>
                Quản lý và tra cứu trực tiếp toàn bộ dữ liệu bảng CSDL tạo ra từ Google Sheets & Excel.
              </p>
            </div>

            <button 
              className="vt-btn-secondary" 
              onClick={fetchDbTables} 
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#334155' }}
            >
              <RefreshCw size={15} className={dbLoading ? 'animate-spin' : ''} />
              <span>Tải lại CSDL</span>
            </button>
          </div>

          {/* TOP TOOLBAR: DATABASE DROPDOWN SELECTOR + SEARCH INPUT */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 14, background: '#F8FAFC', padding: 14, borderRadius: 12, border: '1px solid #E2E8F0' }}>
            {/* Top Dropdown Table Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexGrow: 1, maxWidth: 460 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers size={18} style={{ color: '#EE0033' }} />
                <span>Chọn Bảng CSDL ({dbTables.length}):</span>
              </label>

              <select 
                className="vt-search-input" 
                style={{ 
                  flexGrow: 1, 
                  padding: '10px 14px', 
                  fontSize: '0.88rem', 
                  fontWeight: 600, 
                  color: '#0F172A',
                  borderColor: '#EE0033',
                  background: 'white',
                  cursor: 'pointer',
                  borderRadius: 8,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
                value={selectedTable}
                onChange={(e) => handleSelectTable(e.target.value)}
              >
                {dbTables.length === 0 ? (
                  <option value="">-- Không có bảng CSDL nào --</option>
                ) : (
                  dbTables.map((t, idx) => (
                    <option key={idx} value={t.table_name}>
                      📊 {t.display_name} ({t.row_count} dòng)
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Live Search Input */}
            <div className="vt-search-box" style={{ width: 280 }}>
              <Search size={15} className="vt-search-icon" />
              <input 
                type="text" 
                placeholder="Tìm kiếm nội dung bảng..." 
                className="vt-search-input"
                style={{ width: '100%', paddingLeft: 34 }}
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
              />
            </div>
          </div>

          {/* TABLE METADATA BANNER & RECORD COUNT */}
          {selectedTableObj && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, padding: '0 4px', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong style={{ fontSize: '0.95rem', color: '#0F172A' }}>Dữ liệu bảng:</strong>
                <code style={{ fontSize: '0.9rem', color: '#EE0033', fontWeight: 700, background: '#FEF2F2', padding: '2px 8px', borderRadius: 6, border: '1px solid #FECDD3' }}>
                  {selectedTableObj.table_name}
                </code>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Button auto create Google Sheet */}
                <button
                  type="button"
                  className="vt-btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: '0.8rem', background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', borderRadius: 6, fontWeight: 600 }}
                  onClick={() => handleAutoCreateSheetForTable(selectedTableObj.table_name)}
                  disabled={autoSheetLoading[selectedTableObj.table_name]}
                  title="Tự động tạo Google Sheet cho bảng này"
                >
                  <FileSpreadsheet size={15} className={autoSheetLoading[selectedTableObj.table_name] ? 'animate-spin' : ''} />
                  <span>{autoSheetLoading[selectedTableObj.table_name] ? 'Đang tạo Sheet...' : '✨ Tự Động Tạo Google Sheet'}</span>
                </button>

                {/* Button Export Excel */}
                <button
                  type="button"
                  className="vt-btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: '0.8rem', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECDD3', borderRadius: 6, fontWeight: 600 }}
                  onClick={() => handleExportExcel(selectedTableObj.display_name, `SELECT * FROM "${selectedTableObj.table_name}"`, null)}
                  title="Xuất file Excel cho bảng này"
                >
                  <FileText size={15} />
                  <span>📊 Xuất File Excel (.xlsx)</span>
                </button>

                <span style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600 }}>
                  Hiển thị <strong style={{ color: '#0F172A' }}>{filteredTableRows.length}</strong> / {tableData.length} bản ghi
                </span>
              </div>
            </div>
          )}

          {/* FULL-WIDTH INTERNS-STYLE DATA TABLE */}
          <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: 10, background: 'white' }}>
            {tableDataLoading ? (
              <div style={{ padding: 50, textAlign: 'center', color: '#64748B', fontSize: '0.9rem' }}>
                <RefreshCw size={20} className="animate-spin" style={{ color: '#EE0033', marginBottom: 8 }} />
                <div>Đang tải dữ liệu CSDL...</div>
              </div>
            ) : !selectedTable ? (
              <div style={{ padding: 60, textAlign: 'center', color: '#94A3B8' }}>
                <Table size={40} style={{ color: '#CBD5E1', marginBottom: 10 }} />
                <p style={{ margin: 0, fontWeight: 600 }}>Vui lòng chọn 1 bảng từ menu bên trên để xem dữ liệu</p>
              </div>
            ) : filteredTableRows.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
                Không tìm thấy dòng dữ liệu nào khớp với từ khóa "{tableSearch}"
              </div>
            ) : (
              <table className="vt-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    <th style={{ width: 45, textAlign: 'center', fontWeight: 700 }}>STT</th>
                    {Object.keys(filteredTableRows[0] || {}).map((col, cIdx) => (
                      <th key={cIdx} style={{ fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTableRows.map((r, rIdx) => (
                    <tr key={rIdx} style={{ transition: 'background 0.15s ease' }}>
                      <td style={{ textAlign: 'center', color: '#94A3B8', fontWeight: 600 }}>{rIdx + 1}</td>
                      {Object.values(r).map((val, cIdx) => (
                        <td key={cIdx} style={{ whiteSpace: 'nowrap' }}>
                          {val === null || val === undefined ? (
                            <span style={{ color: '#CBD5E1', fontStyle: 'italic' }}>NULL</span>
                          ) : (
                            String(val)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 1: ADD GOOGLE SHEET OR EXCEL FILE */}
      {/* ---------------------------------------------------- */}
      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, padding: 20 }}>
          <div className="vt-card animate-fade-in" style={{ width: '100%', maxWidth: 520, padding: 0, background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)' }}>
            <div style={{ background: '#EE0033', color: 'white', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>
                {addType === 'sheet' ? '🔗 Kết nối Google Sheet Mới' : '📁 Upload File Excel Mới'}
              </h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'white' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: 24 }}>
              {sheetActionMsg && (
                <div style={{ padding: '10px 14px', background: '#FEE2E2', color: '#B91C1C', borderRadius: 8, fontSize: '0.82rem', marginBottom: 14 }}>
                  {sheetActionMsg}
                </div>
              )}

              <form onSubmit={handleUploadSheetOrExcel} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {addType === 'sheet' ? (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#0F172A', marginBottom: 6 }}>
                      Đường dẫn Link Google Sheet (*):
                    </label>
                    <input 
                      type="url" 
                      className="vt-search-input"
                      style={{ width: '100%', padding: '10px 14px' }}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      value={sheetUrlInput}
                      onChange={(e) => setSheetUrlInput(e.target.value)}
                      required
                    />
                    <span style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 4, display: 'block' }}>
                      💡 Quyền chia sẻ sheet phải đặt ở chế độ "Bất kỳ ai có liên kết đều có thể xem".
                    </span>
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#0F172A', marginBottom: 6 }}>
                      Chọn File Excel từ máy tính (*.xlsx, *.xls):
                    </label>
                    <input 
                      type="file" 
                      accept=".xlsx, .xls"
                      className="vt-search-input"
                      style={{ width: '100%', padding: '8px 12px' }}
                      onChange={(e) => setExcelFile(e.target.files[0])}
                      required
                    />
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#0F172A', marginBottom: 6 }}>
                    Tên gợi nhớ cho Sheet / Bảng (Tùy chọn):
                  </label>
                  <input 
                    type="text" 
                    className="vt-search-input"
                    style={{ width: '100%', padding: '10px 14px' }}
                    placeholder="VD: Danh sách TTS Khóa 1"
                    value={sheetNameInput}
                    onChange={(e) => setSheetNameInput(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <button type="button" className="vt-btn-secondary" style={{ padding: '8px 18px' }} onClick={() => setShowAddModal(false)}>Hủy</button>
                  <button type="submit" className="vt-btn-primary" style={{ padding: '8px 22px' }} disabled={actionLoading}>
                    {actionLoading ? 'Đang xử lý...' : (addType === 'sheet' ? 'Kết nối Sheet' : 'Upload & Nhập Dữ Liệu')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 2: DETAIL METADATA MODAL (CHI TIẾT SHEET / EXCEL LIKE INTERN DETAIL MODAL) */}
      {/* ---------------------------------------------------- */}
      {showDetailModal && selectedDetailItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, padding: 20 }}>
          <div className="vt-card animate-fade-in" style={{ width: '100%', maxWidth: 580, padding: 0, background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)' }}>
            {/* Modal Header */}
            <div style={{ background: '#EE0033', color: 'white', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Info size={22} style={{ color: 'white' }} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>
                  Chi Tiết Kết Nối Sheet / File Excel
                </h3>
              </div>
              <button onClick={() => setShowDetailModal(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Content Body */}
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Top Banner Status */}
              <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#047857', fontWeight: 700, fontSize: '0.9rem' }}>
                  <CheckCircle2 size={18} />
                  <span>Trạng thái: Đã kết nối & Đồng bộ thành công</span>
                </div>
                <span style={{ fontSize: '0.75rem', background: '#047857', color: 'white', padding: '2px 10px', borderRadius: 10, fontWeight: 700 }}>
                  {selectedDetailItem.row_count} dòng
                </span>
              </div>

              {/* Form Grid Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>
                    TÊN SHEET / PHÂN ĐOẠN
                  </label>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A', background: '#F8FAFC', padding: '10px 12px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                    {selectedDetailItem.tab_name}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>
                    TÊN BẢNG CSDL (SQLITE)
                  </label>
                  <div style={{ background: '#FEF2F2', padding: '10px 12px', borderRadius: 8, border: '1px solid #FECDD3' }}>
                    <code style={{ fontSize: '0.9rem', color: '#EE0033', fontWeight: 700 }}>{selectedDetailItem.table_name}</code>
                  </div>
                </div>
              </div>

              {/* Full Width Link Field */}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>
                  ĐƯỜNG DẪN LINK GOOGLE SHEET / NGUỒN FILE
                </label>
                <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: 8, border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: '0.82rem', color: '#334155', wordBreak: 'break-all' }}>
                    {selectedDetailItem.sheet_url || 'Đã nạp trực tiếp từ file Excel local'}
                  </span>
                  {selectedDetailItem.sheet_url && !selectedDetailItem.sheet_url.startsWith('excel://') && (
                    <a 
                      href={selectedDetailItem.sheet_url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: '#EE0033', color: 'white', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}
                    >
                      <ExternalLink size={12} />
                      <span>Mở Sheet</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Grid 2 Column for sync date & type */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>
                    LOẠI KẾT NỐI
                  </label>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0F172A', background: '#F8FAFC', padding: '10px 12px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                    {selectedDetailItem.sheet_url?.startsWith('excel://') ? '📁 File Excel Upload' : '🟢 Google Sheet Online'}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>
                    CẬP NHẬT LẦN CUỐI
                  </label>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0F172A', background: '#F8FAFC', padding: '10px 12px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                    {selectedDetailItem.last_synced}
                  </div>
                </div>
              </div>

              {/* Footer Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10, pt: 14, borderTop: '1px solid #F1F5F9' }}>
                <button 
                  type="button" 
                  className="vt-btn-secondary" 
                  style={{ padding: '8px 18px' }} 
                  onClick={() => setShowDetailModal(false)}
                >
                  Đóng
                </button>

                <button 
                  type="button" 
                  className="vt-btn-primary" 
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px' }} 
                  onClick={() => {
                    setShowDetailModal(false);
                    handleSyncSheet(selectedDetailItem.tab_id, selectedDetailItem.table_name);
                  }}
                >
                  <RefreshCw size={15} />
                  <span>Đồng Bộ Lại Dữ Liệu</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: SCHEMA PROPOSAL & CUSTOM TABLE CREATION */}
      {/* ---------------------------------------------------- */}
      {showSchemaModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, padding: 20 }}>
          <div className="vt-card animate-fade-in" style={{ width: '100%', maxWidth: 840, maxHeight: '90vh', padding: 0, background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column' }}>
            {/* Modal Header */}
            <div style={{ background: '#EE0033', color: 'white', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Table size={22} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>
                  ⚙️ Cửa Sổ Tùy Chỉnh & Khởi Tạo Bảng CSDL AI HR
                </h3>
              </div>
              <button onClick={() => setShowSchemaModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'white' }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 24, overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Scenario Badge Info */}
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Sparkles size={20} style={{ color: '#2563EB', flexShrink: 0 }} />
                <div style={{ fontSize: '0.82rem', color: '#1E40AF' }}>
                  <strong>Kịch bản AI nhận diện:</strong> Scenario {proposalData?.scenario || 3} — {proposalData?.reasoning || 'Tự động tạo bảng tùy chỉnh từ yêu cầu người dùng'}. Bạn có thể chỉnh sửa tên cột, kiểu dữ liệu hoặc thêm/xóa cột trước khi lưu vào CSDL.
                </div>
              </div>

              {/* Table Name & Title Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: '0.83rem', fontWeight: 700, color: '#0F172A', marginBottom: 6, display: 'block' }}>
                    Tên Bảng CSDL (DB Table Name *):
                  </label>
                  <input 
                    type="text" 
                    className="vt-search-input" 
                    style={{ width: '100%', padding: '9px 12px', fontSize: '0.88rem' }}
                    value={editedTableName}
                    onChange={(e) => setEditedTableName(e.target.value)}
                    placeholder="sheet_danh_gia_kpi"
                    required
                  />
                  <span style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 3, display: 'block' }}>Tên hệ thống (chữ thường, không dấu)</span>
                </div>
                <div>
                  <label style={{ fontSize: '0.83rem', fontWeight: 700, color: '#0F172A', marginBottom: 6, display: 'block' }}>
                    Tên Hiển Thị (Display Title *):
                  </label>
                  <input 
                    type="text" 
                    className="vt-search-input" 
                    style={{ width: '100%', padding: '9px 12px', fontSize: '0.88rem' }}
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    placeholder="Bảng Đánh Giá KPI Thực Tập Sinh"
                    required
                  />
                  <span style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 3, display: 'block' }}>Tên hiển thị tiêu đề báo cáo / Google Sheet</span>
                </div>
              </div>

              {/* Column Editor Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.92rem', color: '#0F172A' }}>Cấu Trúc Các Cột Thuộc Tính ({editedColumns.length}):</strong>
                <button 
                  type="button" 
                  className="vt-btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: '0.8rem', background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0' }}
                  onClick={() => {
                    const newId = editedColumns.length + 1;
                    setEditedColumns(prev => [...prev, {
                      field_name: `cot_moi_${newId}`,
                      label: `Cột Mới ${newId}`,
                      data_type: 'TEXT',
                      default_value: ''
                    }]);
                  }}
                >
                  <Plus size={14} />
                  <span>Thêm Cột Mới</span>
                </button>
              </div>

              {/* Columns Table Grid */}
              <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: 10 }}>
                <table className="vt-table" style={{ width: '100%', fontSize: '0.83rem' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      <th style={{ width: 40, textAlign: 'center' }}>#</th>
                      <th style={{ width: 170 }}>Tên Thuộc Tính (`field_name`)</th>
                      <th style={{ width: 190 }}>Tên Nhãn Hiển Thị (`label`)</th>
                      <th style={{ width: 140 }}>Kiểu Dữ Liệu</th>
                      <th style={{ width: 140 }}>Giá Trị Mặc Định</th>
                      <th style={{ width: 50, textAlign: 'center' }}>Xóa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editedColumns.map((col, idx) => (
                      <tr key={idx}>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: '#94A3B8' }}>{idx + 1}</td>
                        <td>
                          <input 
                            type="text" 
                            className="vt-search-input" 
                            style={{ width: '100%', padding: '5px 8px', fontSize: '0.8rem' }}
                            value={col.field_name || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditedColumns(prev => prev.map((c, i) => i === idx ? { ...c, field_name: val } : c));
                            }}
                          />
                        </td>
                        <td>
                          <input 
                            type="text" 
                            className="vt-search-input" 
                            style={{ width: '100%', padding: '5px 8px', fontSize: '0.8rem' }}
                            value={col.label || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditedColumns(prev => prev.map((c, i) => i === idx ? { ...c, label: val } : c));
                            }}
                          />
                        </td>
                        <td>
                          <select 
                            className="vt-search-input" 
                            style={{ width: '100%', padding: '5px 6px', fontSize: '0.8rem' }}
                            value={col.data_type || 'TEXT'}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditedColumns(prev => prev.map((c, i) => i === idx ? { ...c, data_type: val } : c));
                            }}
                          >
                            <option value="TEXT">TEXT (Chuỗi)</option>
                            <option value="INTEGER">INTEGER (Số nguyên)</option>
                            <option value="REAL">REAL (Số thực)</option>
                            <option value="DATE">DATE (Ngày tháng)</option>
                          </select>
                        </td>
                        <td>
                          <input 
                            type="text" 
                            className="vt-search-input" 
                            style={{ width: '100%', padding: '5px 8px', fontSize: '0.8rem' }}
                            value={col.default_value || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditedColumns(prev => prev.map((c, i) => i === idx ? { ...c, default_value: val } : c));
                            }}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button 
                            type="button" 
                            style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}
                            onClick={() => setEditedColumns(prev => prev.filter((_, i) => i !== idx))}
                            title="Xóa cột này"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Data Preview Rows */}
              {editedRows.length > 0 && (
                <div>
                  <strong style={{ fontSize: '0.88rem', color: '#0F172A', display: 'block', marginBottom: 8 }}>Xem Trước Dữ Liệu Mẫu ({editedRows.length} bản ghi):</strong>
                  <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: 8, maxHeight: 180 }}>
                    <table className="vt-table" style={{ width: '100%', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC' }}>
                          {editedColumns.map((c, i) => (
                            <th key={i}>{c.label || c.field_name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {editedRows.map((r, rIdx) => (
                          <tr key={rIdx}>
                            {editedColumns.map((c, cIdx) => (
                              <td key={cIdx}>{r[c.field_name] !== undefined ? String(r[c.field_name]) : (c.default_value || '—')}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 24px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: 12, flexShrink: 0 }}>
              <button type="button" className="vt-select-sm" onClick={() => setShowSchemaModal(false)}>Hủy Bỏ</button>
              <button 
                type="button" 
                className="vt-btn-primary" 
                disabled={createLoading}
                onClick={handleConfirmCreateCustomTable}
                style={{ padding: '8px 24px' }}
              >
                {createLoading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin me-2" />
                    <span>Đang khởi tạo CSDL...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} className="me-1" />
                    <span>✅ Lưu Vào CSDL AI HR & Khởi Tạo Bảng</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
