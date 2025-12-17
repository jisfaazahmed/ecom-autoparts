import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeShops: 0,
    totalOrders: 0,
    pendingApprovals: 0
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!token) {
      navigate('/');
    } else {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);

      // SECURITY CHECK: Kick out Customers
      if (parsedUser.role === 'USER') {
        navigate('/home'); 
        return;
      }

      fetchStats();
    }
  }, [navigate]);

  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/stats');
      setStats(res.data);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
      {/* Top Navigation Bar */}
      <nav className="navbar">
        <div className="navbar-brand">🚗 AutoParts Admin</div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem', marginRight: '10px' }}>
             {user?.name} <span style={{ opacity: 0.6 }}>({user?.role})</span>
          </span>
          <button onClick={handleLogout} className="btn btn-outline" style={{ fontSize: '0.85rem', padding: '8px 16px' }}>
            Logout
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>Dashboard Overview</h2>
          
          {user?.role === 'SUPER_ADMIN' && stats.pendingApprovals > 0 && (
             <button onClick={() => navigate('/approvals')} className="btn btn-warning">
                ⚠️ Review Pending ({stats.pendingApprovals})
             </button>
          )}
        </div>

        {/* Stats Grid */}
        <div className="dashboard-grid">
          <div className="stat-card">
            <div className="stat-title">Total Orders</div>
            <div className="stat-number">{stats.totalOrders}</div>
          </div>

          <div 
            className="stat-card" 
            onClick={() => user?.role === 'SUPER_ADMIN' && navigate('/shops')} // <--- Clickable
            style={{ cursor: user?.role === 'SUPER_ADMIN' ? 'pointer' : 'default' }}
          >
            <div className="stat-title">Active Shops</div>
            <div className="stat-number">{stats.activeShops}</div>
          </div>

          <div 
            className="stat-card" 
            onClick={() => user?.role === 'SUPER_ADMIN' && navigate('/users')} // <--- Clickable
            style={{ cursor: user?.role === 'SUPER_ADMIN' ? 'pointer' : 'default' }}
          >
            <div className="stat-title">Total Users</div>
            <div className="stat-number">{stats.totalUsers}</div>
          </div>

          <div 
            className="stat-card" 
            onClick={() => user?.role === 'SUPER_ADMIN' && navigate('/approvals')}
            style={{ 
               cursor: user?.role === 'SUPER_ADMIN' ? 'pointer' : 'default',
               border: stats.pendingApprovals > 0 ? '2px solid var(--warning)' : 'none'
            }}
          >
            <div className="stat-title">Pending Approvals</div>
            <div className="stat-number" style={{ color: stats.pendingApprovals > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
              {stats.pendingApprovals}
            </div>
            {user?.role === 'SUPER_ADMIN' && <small style={{ color: 'var(--primary)' }}>Click to review</small>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;