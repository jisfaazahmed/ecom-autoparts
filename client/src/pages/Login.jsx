import { useState } from 'react';
import api from '../api/api';
import { useNavigate, Link } from 'react-router-dom'; // <--- Import this

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [message, setMessage] = useState('');
  const navigate = useNavigate(); // <--- Initialize hook

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    try {
      const res = await api.post('/auth/login', formData);
      
      console.log("Login Response:", res.data); // <--- DEBUG LOG

      // 1. Save Token & User
      localStorage.setItem('token', res.data.token);
      const userData = res.data.user || res.data;
      localStorage.setItem('user', JSON.stringify(userData));

      // 2. SMART REDIRECT (The Fix)
      if (userData.role === 'SUPER_ADMIN') {
        navigate('/dashboard'); // Only Super Admin goes here
      } else if (userData.role === 'ADMIN') {
        navigate('/myshop');    // Vendors go to their Shop Panel
      } else {
        navigate('/home');      // Customers go to the Storefront
      }

    } catch (err) {
      console.error(err);
      setMessage(`❌ Error: ${err.response?.data?.message || 'Login failed'}`);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px', color: 'var(--primary)' }}>Welcome Back</h2>
        
        {message && <div style={{ padding: '10px', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', marginBottom: '15px', fontSize: '0.9rem' }}>{message}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input className="form-input" type="email" name="email" value={formData.email} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" name="password" value={formData.password} onChange={handleChange} required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Login</button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.9rem', color: '#666' }}>
          New here? <Link to="/register" style={{ color: 'var(--primary)', fontWeight: '600' }}>Create an account</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;