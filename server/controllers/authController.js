// CRITICAL FIX: Import 'user.model', NOT 'User'
const User = require('../models/user.model'); 
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Register User
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, shopName } = req.body;

    // 1. Prevent Super Admin creation via public API
    if (role === 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Cannot register as Super Admin.' });
    }

    // 2. Check if user exists
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'User already exists' });

    // 3. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Create User
    user = new User({
      name,
      email,
      password: hashedPassword,
      role: role || 'USER',
      shopName: role === 'ADMIN' ? shopName : undefined,
      // CRITICAL: Ensure this matches your Model's Expected Values!
      status: role === 'ADMIN' ? 'PENDING' : 'APPROVED' 
    });

    await user.save();

    res.status(201).json({ 
      message: role === 'ADMIN' 
        ? 'Registration successful! Wait for Super Admin approval.' 
        : 'Registration successful! Please login.' 
    });

  } catch (err) {
    console.error("Registration Error:", err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
};

// Login User
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Check User
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    // 2. Check Status (Security Gate)
    if (user.status === 'PENDING') {
      return res.status(403).json({ message: 'Your account is pending approval.' });
    }
    if (user.status === 'REJECTED') {
      return res.status(403).json({ message: 'Your account has been rejected.' });
    }

    // 3. Check Password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    // 4. Generate Token
    const payload = { user: { id: user.id, role: user.role } };
    
    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'secret123',
      { expiresIn: '1d' },
      (err, token) => {
        if (err) throw err;
        res.json({ 
          token, 
          user: { 
            id: user.id, 
            name: user.name, 
            email: user.email, 
            role: user.role,
            shopName: user.shopName 
          } 
        });
      }
    );
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).send('Server error');
  }
};