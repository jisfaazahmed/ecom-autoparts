import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    // 1. Check if token exists
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/'); // Redirect to login if not authenticated
    } else {
      // Load user info from storage (or you could fetch from API)
      const storedUser = localStorage.getItem('user');
      if (storedUser) setUser(JSON.parse(storedUser));
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #333', paddingBottom: '10px' }}>
        <h1>🚗 AutoParts Admin</h1>
        <button onClick={handleLogout} style={{ background: 'red', color: 'white', border: 'none', padding: '10px 20px', cursor: 'pointer' }}>
          Logout
        </button>
      </header>

      <div style={{ marginTop: '20px' }}>
        <h2>Welcome, {user?.name || 'Admin'}!</h2>
        <p>Role: <strong>{user?.role || 'Unknown'}</strong></p>
        
        {/* Simple Dashboard Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginTop: '20px' }}>
          <div style={cardStyle}>
            <h3>🛒 Total Orders</h3>
            <p>0</p>
          </div>
          <div style={cardStyle}>
            <h3>🏬 Active Shops</h3>
            <p>1 (HQ)</p>
          </div>
          <div style={cardStyle}>
            <h3>👥 Total Users</h3>
            <p>1</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const cardStyle = {
  border: '1px solid #ddd',
  padding: '20px',
  borderRadius: '8px',
  boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
  textAlign: 'center'
};

export default Dashboard;