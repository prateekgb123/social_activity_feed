// server.js - backend + static file serving
require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'prateek123';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/socialapp';

// Where frontend static files live (relative to backend folder)
const FRONTEND_DIR = process.env.FRONTEND_DIR || path.join(__dirname, '..', 'frontend');

app.use(cors());
app.use(express.json());

// Basic root health (not the SPA)
app.get('/api/test', (req, res) => res.json({ message: 'API is working!' }));

// ------------------------
// Mongoose models & DB
// ------------------------
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role:     { type: String, enum: ['user','admin','owner'], default: 'user' },
  followers:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  blockedUsers:[{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const postSchema = new mongoose.Schema({
  content: { type: String, required: true },
  author:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  likes:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt:{ type: Date, default: Date.now }
});
const Post = mongoose.model('Post', postSchema);

const activitySchema = new mongoose.Schema({
  type: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  message: { type: String, required: true },
  createdAt:{ type: Date, default: Date.now }
});
const Activity = mongoose.model('Activity', activitySchema);

// ------------------------
// DB connect
// ------------------------
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ------------------------
// Auth middleware
// ------------------------
const auth = async (req, res, next) => {
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
};

const adminAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Please authenticate' });
  if (req.user.role !== 'admin' && req.user.role !== 'owner') return res.status(403).json({ error: 'Admin access required' });
  next();
};
const ownerAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Please authenticate' });
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Owner access required' });
  next();
};

// Activity helper
const createActivity = async (type, userId, targetUserId=null, postId=null, message='') => {
  try {
    const activity = new Activity({ type, user: userId, targetUser: targetUserId, post: postId, message });
    await activity.save();
  } catch (e) {
    console.error('createActivity err', e);
  }
};

// ------------------------
// API ROUTES (prefix /api)
// ------------------------
// Auth
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'Missing fields' });
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) return res.status(400).json({ error: 'User already exists' });
    const hashed = await bcrypt.hash(password, 10);
    const userCount = await User.countDocuments();
    const role = userCount === 0 ? 'owner' : 'user';
    const user = new User({ username, email, password: hashed, role });
    await user.save();
    const token = jwt.sign({ userId: user._id }, JWT_SECRET);
    await createActivity('signup', user._id, null, null, `${user.username} signed up`);
    res.status(201).json({ user: { id: user._id, username: user.username, email: user.email, role: user.role }, token });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ userId: user._id }, JWT_SECRET);
    res.json({ user: { id: user._id, username: user.username, email: user.email, role: user.role }, token });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Users
app.get('/api/users/me', auth, async (req, res) => {
  const u = req.user.toObject();
  res.json({ id: u._id, username: u.username, email: u.email, role: u.role, followers: u.followers || [], following: u.following || [], blockedUsers: u.blockedUsers || [] });
});

app.get('/api/users', auth, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } }).select('username email role followers following createdAt');
    res.json(users);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/users/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('username email role followers following createdAt');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Follow/unfollow
app.post('/api/users/:id/follow', auth, async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (req.user._id.equals(target._id)) return res.status(400).json({ error: 'Cannot follow yourself' });
    if (req.user.following.some(f => f.equals(target._id))) return res.status(400).json({ error: 'Already following' });
    req.user.following.push(target._id);
    target.followers.push(req.user._id);
    await req.user.save();
    await target.save();
    await createActivity('follow', req.user._id, target._id, null, `${req.user.username} followed ${target.username}`);
    res.json({ message: 'Successfully followed user' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/users/:id/unfollow', auth, async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    req.user.following = req.user.following.filter(id => !id.equals(target._id));
    target.followers = target.followers.filter(id => !id.equals(req.user._id));
    await req.user.save();
    await target.save();
    res.json({ message: 'Successfully unfollowed user' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Block/unblock
app.post('/api/users/:id/block', auth, async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (req.user._id.equals(target._id)) return res.status(400).json({ error: 'Cannot block yourself' });
    if (req.user.blockedUsers.some(b => b.equals(target._id))) return res.status(400).json({ error: 'User already blocked' });
    req.user.blockedUsers.push(target._id);
    await req.user.save();
    res.json({ message: 'User blocked successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/users/:id/unblock', auth, async (req, res) => {
  try {
    req.user.blockedUsers = req.user.blockedUsers.filter(id => id.toString() !== req.params.id.toString());
    await req.user.save();
    res.json({ message: 'User unblocked successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Posts
app.post('/api/posts', auth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Post content required' });
    const post = new Post({ content, author: req.user._id });
    await post.save();
    await post.populate('author', 'username');
    await createActivity('post', req.user._id, null, post._id, `${req.user.username} made a post`);
    res.status(201).json(post);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/posts', auth, async (req, res) => {
  try {
    const posts = await Post.find({ author: { $nin: req.user.blockedUsers } }).populate('author', 'username').populate('likes', 'username').sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/posts/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (!post.author.equals(req.user._id)) return res.status(403).json({ error: 'Not authorized' });
    await Post.findByIdAndDelete(req.params.id);
    res.json({ message: 'Post deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/posts/:id/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate('author', 'username');
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.likes.some(l => l.equals(req.user._id))) return res.status(400).json({ error: 'Already liked this post' });
    post.likes.push(req.user._id);
    await post.save();
    await createActivity('like', req.user._id, null, post._id, `${req.user.username} liked ${post.author.username}'s post`);
    res.json({ message: 'Post liked successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/posts/:id/unlike', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    post.likes = post.likes.filter(id => !id.equals(req.user._id));
    await post.save();
    res.json({ message: 'Post unliked successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Activities
app.get('/api/activities', auth, async (req, res) => {
  try {
    const activities = await Activity.find().populate('user', 'username').populate('targetUser', 'username').populate('post', 'content').sort({ createdAt: -1 }).limit(50);
    res.json(activities);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin & owner routes (delete user/post, manage admins)
app.delete('/api/admin/users/:id', auth, adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'owner') return res.status(403).json({ error: 'Cannot delete owner' });
    await User.findByIdAndDelete(req.params.id);
    await Post.deleteMany({ author: req.params.id });
    await createActivity('delete_user', req.user._id, req.params.id, null, `User ${user.username} deleted by '${req.user.role}'`);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/posts/:id', auth, adminAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate('author', 'username');
    if (!post) return res.status(404).json({ error: 'Post not found' });
    await Post.findByIdAndDelete(req.params.id);
    await createActivity('delete_post', req.user._id, null, null, `Post by ${post.author.username} deleted by '${req.user.role}'`);
    res.json({ message: 'Post deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/likes/:postId/:userId', auth, adminAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    post.likes = post.likes.filter(id => !id.equals(req.params.userId));
    await post.save();
    res.json({ message: 'Like deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/owner/admins', auth, ownerAuth, async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ error: 'User is already an admin' });
    user.role = 'admin';
    await user.save();
    res.json({ message: 'Admin created successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/owner/admins/:id', auth, ownerAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'admin') return res.status(400).json({ error: 'User is not an admin' });
    user.role = 'user';
    await user.save();
    res.json({ message: 'Admin removed successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ------------------------
// Serve frontend static files
// ------------------------
// Serve files under FRONTEND_DIR at root path (/) — but keep /api/* routes working above.
app.use(express.static(FRONTEND_DIR));

// For any non-API route, return index.html (SPA fallback)
app.get('*', (req, res, next) => {
  // If the request starts with /api, pass along (should not reach here)
  if (req.path.startsWith('/api')) return next();
  const indexPath = path.join(FRONTEND_DIR, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error sending index.html:', err);
      res.status(404).send('Not found');
    }
  });
});

// ------------------------
// Start server
// ------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT} — serving static from ${FRONTEND_DIR}`));