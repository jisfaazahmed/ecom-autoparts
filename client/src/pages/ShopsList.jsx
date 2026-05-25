import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';

const ShopsList = () => {
  const [shops, setShops] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchShops = async () => {
      try {
        const res = await api.get('/admin/shops');
        setShops(res.data);
      } catch (err) {
        console.error("Failed to load shops");
      }
    };
    fetchShops();
  }, []);

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>🏬 Active Shops</h2>
        <button onClick={() => navigate('/dashboard')} className="btn btn-outline">← Back</button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Shop Name</th>
              <th>Owner Name</th>
              <th>Email</th>
              <th>Joined Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {shops.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center' }}>No active shops found.</td></tr>
            ) : (
              shops.map(shop => (
                <tr key={shop._id}>
                  <td style={{ fontWeight: 'bold' }}>{shop.shopName}</td>
                  <td>{shop.name}</td>
                  <td>{shop.email}</td>
                  <td>{new Date(shop.createdAt).toLocaleDateString()}</td>
                  <td><span className="badge badge-green">Active</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ShopsList;