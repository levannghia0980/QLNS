import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('UI Render Error caught by ErrorBoundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 40,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          textAlign: 'center'
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: '#FEE2E2', color: '#EE0033',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16
          }}>
            <AlertTriangle size={28} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
            Đã xảy ra sự cố hiển thị
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#64748B', maxWidth: 460, marginBottom: 20 }}>
            {this.state.error?.message || 'Không thể nạp dữ liệu từ CSDL. Vui lòng làm mới trang hoặc đăng nhập lại.'}
          </p>
          <button className="vt-btn-primary" onClick={this.handleReset}>
            <RefreshCw size={16} />
            <span>Tải lại trang</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
