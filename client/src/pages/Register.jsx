import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/api';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'USER', // Default is Customer
    shopName: ''
  });
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    try {
      await api.post('/auth/register', formData);
      alert('✅ Registration Successful! Please login after Admin approval.');
      navigate('/'); // Redirect to Login
    } catch (err) {
      setMessage(`❌ Error: ${err.response?.data?.message || 'Registration failed'}`);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>Create Account</h2>
      {message && <p style={{ color: 'red' }}>{message}</p>}
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label>Full Name</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} required style={inputStyle} />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Email</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} required style={inputStyle} />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Password</label>
          <input type="password" name="password" value={formData.password} onChange={handleChange} required style={inputStyle} />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>I want to be a:</label>
          <select name="role" value={formData.role} onChange={handleChange} style={inputStyle}>
            <option value="USER">Customer</option>
            <option value="ADMIN">Shop Owner (Vendor)</option>
          </select>
        </div>

        {/* Show Shop Name only if "Shop Owner" is selected */}
        {formData.role === 'ADMIN' && (
          <div style={{ marginBottom: '15px' }}>
            <label>Shop Name</label>
            <input type="text" name="shopName" value={formData.shopName} onChange={handleChange} required style={inputStyle} />
          </div>
        )}

        <button type="submit" style={buttonStyle}>Register</button>
      </form>

      <p style={{ marginTop: '15px', textAlign: 'center' }}>
        Already have an account? <Link to="/">Login here</Link>
      </p>
    </div>
  );
};

const inputStyle = { width: '100%', padding: '8px', marginTop: '5px', boxSizing: 'border-box' };
const buttonStyle = { width: '100%', padding: '12px', background: 'green', color: 'white', border: 'none', cursor: 'pointer', marginTop: '10px' };

export default Register;