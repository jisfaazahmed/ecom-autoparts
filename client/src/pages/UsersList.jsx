import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';

const UsersList = () => {
  const [users, setUsers] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get('/admin/users');
        setUsers(res.data);
      } catch (err) {
        console.error("Failed to load users");
      }
    };
    fetchUsers();
  }, []);

  // Helper to choose badge color
  const getRoleBadge = (role) => {
    switch (role) {
      case 'SUPER_ADMIN': return <span className="badge" style={{ background: 'black', color: 'white' }}>Super Admin</span>;
      case 'ADMIN': return <span className="badge" style={{ background: 'purple', color: 'white' }}>Shop Owner</span>;
      default: return <span className="badge badge-blue">Customer</span>;
    }
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>👥 All System Users</h2>
        <button onClick={() => navigate('/dashboard')} className="btn btn-outline">← Back</button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Joined Date</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan="4" style={{ textAlign: 'center' }}>No users found.</td></tr>
            ) : (
              users.map(user => (
                <tr key={user._id}>
                  <td style={{ fontWeight: 'bold' }}>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{getRoleBadge(user.role)}</td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UsersList;