import { useState } from 'react';
import api from '../api/api';
import { useNavigate } from 'react-router-dom'; // <--- Import this

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
      
      // 1. Save Token
      localStorage.setItem('token', res.data.token);
      
      // 2. Save User Info (Optional but useful)
      if(res.data.user) {
        localStorage.setItem('user', JSON.stringify(res.data.user));
      }

      // 3. Redirect immediately
      navigate('/dashboard'); 

    } catch (err) {
      setMessage(`❌ Error: ${err.response?.data?.message || 'Login failed'}`);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>System Login</h2>
      {message && <p style={{ color: 'red' }}>{message}</p>}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} required style={{ width: '100%', padding: '10px' }} />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <input type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} required style={{ width: '100%', padding: '10px' }} />
        </div>
        <button type="submit" style={{ width: '100%', padding: '12px', background: 'blue', color: 'white', border: 'none', cursor: 'pointer' }}>Login</button>
      </form>
    </div>
  );
};

export default Login;