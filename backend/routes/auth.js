const express4 = require('express');
const routerAuth = express4.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserAuth = require('../models/User');
const { createActivity } = require('../utils/activity');
const JWT_SECRET2 = process.env.JWT_SECRET || 'prateek123';


routerAuth.post('/signup', async (req, res) => {
try {
const { username, email, password } = req.body;
if (!username || !email || !password) return res.status(400).json({ error: 'Missing fields' });
const existing = await UserAuth.findOne({ $or: [{ email }, { username }] });
if (existing) return res.status(400).json({ error: 'User already exists' });
const hashed = await bcrypt.hash(password, 10);
const userCount = await UserAuth.countDocuments();
const role = userCount === 0 ? 'owner' : 'user';
const user = new UserAuth({ username, email, password: hashed, role });
await user.save();
const token = jwt.sign({ userId: user._id }, JWT_SECRET2);
await createActivity('signup', user._id, null, null, `${user.username} signed up`);
res.status(201).json({ user: { id: user._id, username: user.username, email: user.email, role: user.role }, token });
} catch (err) {
res.status(400).json({ error: err.message });
}
});


routerAuth.post('/login', async (req, res) => {
try {
const { email, password } = req.body;
if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
const user = await UserAuth.findOne({ email });
if (!user) return res.status(401).json({ error: 'Invalid credentials' });
const isMatch = await bcrypt.compare(password, user.password);
if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });
const token = jwt.sign({ userId: user._id }, JWT_SECRET2);
res.json({ user: { id: user._id, username: user.username, email: user.email, role: user.role }, token });
} catch (err) {
res.status(400).json({ error: err.message });
}
});


module.exports = routerAuth;