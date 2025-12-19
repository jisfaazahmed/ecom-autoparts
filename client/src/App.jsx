import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Import all your pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Approvals from './pages/Approvals';
import ShopsList from './pages/ShopsList';
import UsersList from './pages/UsersList';
import Home from './pages/Home';
import MyShop from './pages/MyShop'; // <--- 1. Make sure this import is here

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/home" element={<Home />} />

        {/* Super Admin Routes */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/shops" element={<ShopsList />} />
        <Route path="/users" element={<UsersList />} />

        {/* Shop Owner Route */}
        <Route path="/myshop" element={<MyShop />} /> {/* <--- 2. Make sure this Route is here */}
      </Routes>
    </Router>
  );
}

export default App;