import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Approvals from './pages/Approvals';
import ShopsList from './pages/ShopsList';
import UsersList from './pages/UsersList';
import Home from './pages/Home';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/shops" element={<ShopsList />} />
        <Route path="/users" element={<UsersList />} />
        <Route path="/home" element={<Home />} />
      </Routes>
    </Router>
  );
}

export default App;