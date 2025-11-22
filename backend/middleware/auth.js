const jwt = require('jsonwebtoken');
const User = require('../models/User');
const JWT_SECRET = process.env.JWT_SECRET || 'prateek123';


async function auth(req, res, next) {
try {
const header = req.header('Authorization');
if (!header) return res.status(401).json({ error: 'Please authenticate' });
const token = header.replace('Bearer ', '');
const decoded = jwt.verify(token, JWT_SECRET);
const user = await User.findById(decoded.userId);
if (!user) return res.status(401).json({ error: 'Please authenticate' });
req.user = user;
next();
} catch (err) {
res.status(401).json({ error: 'Please authenticate' });
}
}


function adminAuth(req, res, next) {
if (!req.user) return res.status(401).json({ error: 'Please authenticate' });
if (req.user.role !== 'admin' && req.user.role !== 'owner') return res.status(403).json({ error: 'Admin access required' });
next();
}


function ownerAuth(req, res, next) {
if (!req.user) return res.status(401).json({ error: 'Please authenticate' });
if (req.user.role !== 'owner') return res.status(403).json({ error: 'Owner access required' });
next();
}


module.exports = { auth, adminAuth, ownerAuth };