import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
    <div className="container" style={{ marginTop: '50px', textAlign: 'center' }}>
      <h1>🚗 Welcome to AutoParts Market</h1>
      <p>Find the best parts for your vehicle.</p>
      
      {/* Placeholder for Product Grid */}
      <div style={{ padding: '40px', background: '#f3f4f6', borderRadius: '8px', marginTop: '20px' }}>
        <h3>🛍️ Products Coming Soon!</h3>
        <p>We are stocking up the shelves.</p>
      </div>

      <div style={{ marginTop: '30px' }}>
        {user ? (
            <div>
                <p>Logged in as: <strong>{user.name}</strong></p>
                <button onClick={handleLogout} className="btn btn-danger">Logout</button>
            </div>
        ) : (
            <button onClick={() => navigate('/')} className="btn btn-primary">Login</button>
        )}
      </div>
    </div>
  );
};

export default Home;