// routes/admin.js
const express = require('express');
const routerAdmin = express.Router();

const UserAdmin = require('../models/User');
const PostAdmin = require('../models/Post');
const { auth, adminAuth, ownerAuth } = require('../middleware/auth');
const { createActivity: createActivity4 } = require('../utils/activity');

routerAdmin.delete('/users/:id', auth, adminAuth, async (req, res) => {
  try {
    const user = await UserAdmin.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'owner') return res.status(403).json({ error: 'Cannot delete owner' });

    await UserAdmin.findByIdAndDelete(req.params.id);
    await PostAdmin.deleteMany({ author: req.params.id });
    await createActivity4('delete_user', req.user._id, req.params.id, null, `User ${user.username} deleted by '${req.user.role}'`);

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

routerAdmin.delete('/posts/:id', auth, adminAuth, async (req, res) => {
  try {
    const post = await PostAdmin.findById(req.params.id).populate('author', 'username');
    if (!post) return res.status(404).json({ error: 'Post not found' });

    await PostAdmin.findByIdAndDelete(req.params.id);
    // FIXED: use req.user._id (not req.user._1)
    await createActivity4('delete_post', req.user._id, null, null, `Post by ${post.author.username} deleted by '${req.user.role}'`);

    res.json({ message: 'Post deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

routerAdmin.delete('/likes/:postId/:userId', auth, adminAuth, async (req, res) => {
  try {
    const post = await PostAdmin.findById(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    // remove the like by userId
    post.likes = post.likes.filter(id => !id.equals(req.params.userId));
    await post.save();

    res.json({ message: 'Like deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

routerAdmin.post('/admins', auth, ownerAuth, async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await UserAdmin.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ error: 'User is already an admin' });

    user.role = 'admin';
    await user.save();

    res.json({ message: 'Admin created successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

routerAdmin.delete('/admins/:id', auth, ownerAuth, async (req, res) => {
  try {
    const user = await UserAdmin.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'admin') return res.status(400).json({ error: 'User is not an admin' });

    user.role = 'user';
    await user.save();

    res.json({ message: 'Admin removed successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = routerAdmin;
