import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';

const MyShop = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [stats, setStats] = useState({ products: 0, orders: 0, totalSalesLkr: 0 });
  const [loading, setLoading] = useState(true);
  const [statsError, setStatsError] = useState('');

  useEffect(() => {
    if (user.role !== 'ADMIN') {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/vendor/dashboard/stats');
        if (!cancelled) {
          setStats({
            products: data.products ?? 0,
            orders: data.orders ?? 0,
            totalSalesLkr: data.totalSalesLkr ?? 0,
          });
          setStatsError('');
        }
      } catch (err) {
        if (!cancelled) {
          setStatsError(err.response?.data?.message || 'Could not load dashboard stats.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user.role]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
    <div className="container" style={{ marginTop: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd', paddingBottom: '20px' }}>
        <div>
            <h1 style={{ margin: 0 }}>🏪 {user.shopName || 'My Shop'}</h1>
            <p style={{ margin: '5px 0 0 0', color: '#666' }}>Vendor Panel • Welcome, {user.name}</p>
        </div>
        <button onClick={handleLogout} className="btn btn-danger">Logout</button>
      </div>

      {statsError && (
        <div style={{ marginTop: '16px', padding: '12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', fontSize: '0.9rem' }}>
          {statsError}
        </div>
      )}

      <div className="dashboard-grid" style={{ marginTop: '30px' }}>
        <div className="stat-card">
          <div className="stat-title">My Products</div>
          <div className="stat-number">{loading ? '…' : stats.products}</div>
          <button type="button" className="btn btn-primary" style={{ marginTop: '10px', fontSize: '0.8rem' }}>+ Add Product</button>
        </div>

        <div className="stat-card">
          <div className="stat-title">Total Sales</div>
          <div className="stat-number">
            {loading ? '…' : `LKR ${Number(stats.totalSalesLkr).toLocaleString('en-LK')}`}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-title">Orders</div>
          <div className="stat-number">{loading ? '…' : stats.orders}</div>
        </div>
      </div>

      <div style={{ marginTop: '40px', textAlign: 'center', padding: '40px', background: '#f9fafb', borderRadius: '8px' }}>
        <h3>🚀 Ready to sell?</h3>
        <p>Start adding your car parts to the marketplace.</p>
      </div>
    </div>
  );
};

export default MyShop;