import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';

const Approvals = () => {
  const [users, setUsers] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const fetchPendingUsers = async () => {
    try {
      const res = await api.get('/admin/pending-users');
      setUsers(res.data);
    } catch (err) {
      alert("Failed to load users");
    }
  };

  const handleStatus = async (id, status) => {
    try {
      await api.put(`/admin/update-status/${id}`, { status });
      // Remove the processed user from the list immediately
      setUsers(users.filter(user => user._id !== id));
      alert(`User ${status}!`);
    } catch (err) {
      alert("Action failed");
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <button onClick={() => navigate('/dashboard')} style={{ marginBottom: '20px', cursor: 'pointer' }}>
        ← Back to Dashboard
      </button>
      
      <h2>⏳ Pending Approvals</h2>

      {users.length === 0 ? (
        <p>No pending approvals.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
          <thead>
            <tr style={{ background: '#eee', textAlign: 'left' }}>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Role</th>
              <th style={thStyle}>Shop Name</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user._id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={tdStyle}>{user.name}</td>
                <td style={tdStyle}>{user.email}</td>
                <td style={tdStyle}>
                    <span style={{ 
                        background: user.role === 'ADMIN' ? 'purple' : 'blue', 
                        color: 'white', padding: '3px 8px', borderRadius: '4px', fontSize: '12px' 
                    }}>
                        {user.role === 'ADMIN' ? 'Shop Owner' : 'Customer'}
                    </span>
                </td>
                <td style={tdStyle}>{user.shopName || '-'}</td>
                <td style={tdStyle}>
                  <button 
                    onClick={() => handleStatus(user._id, 'APPROVED')} 
                    style={{ ...btnStyle, background: 'green' }}>
                    Approve
                  </button>
                  <button 
                    onClick={() => handleStatus(user._id, 'REJECTED')} 
                    style={{ ...btnStyle, background: 'red', marginLeft: '10px' }}>
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

const thStyle = { padding: '10px', borderBottom: '2px solid #ddd' };
const tdStyle = { padding: '10px' };
const btnStyle = { color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer', borderRadius: '4px' };

export default Approvals;