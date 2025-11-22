// routes/users.js
const express = require('express');
const routerUsers = express.Router();

const UserModel = require('../models/User');
const { auth } = require('../middleware/auth');
const { createActivity } = require('../utils/activity');

// Get own profile
routerUsers.get('/me', auth, async (req, res) => {
  try {
    const u = req.user.toObject();
    res.json({
      id: u._id,
      username: u.username,
      email: u.email,
      role: u.role,
      followers: u.followers || [],
      following: u.following || [],
      blockedUsers: u.blockedUsers || []
    });
  } catch (err) {
    console.error('GET /api/users/me error:', err);
    res.status(400).json({ error: err.message || 'Unknown error' });
  }
});

// List users (exclude self)
routerUsers.get('/', auth, async (req, res) => {
  try {
    const users = await UserModel.find({ _id: { $ne: req.user._id } })
      .select('username email role followers following createdAt');
    res.json(users);
  } catch (err) {
    console.error('GET /api/users error:', err);
    res.status(400).json({ error: err.message || 'Unknown error' });
  }
});

// Get a single user
routerUsers.get('/:id', auth, async (req, res) => {
  try {
    const user = await UserModel.findById(req.params.id).select('username email role followers following createdAt');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(`GET /api/users/${req.params.id} error:`, err);
    res.status(400).json({ error: err.message || 'Unknown error' });
  }
});

// Follow
routerUsers.post('/:id/follow', auth, async (req, res) => {
  try {
    const target = await UserModel.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    const meId = req.user._id.toString();
    const targetId = target._id.toString();

    if (meId === targetId) return res.status(400).json({ error: 'Cannot follow yourself' });

    // Use string comparison to avoid ObjectId type issues
    if ((req.user.following || []).some(f => f.toString() === targetId)) {
      return res.status(400).json({ error: 'Already following' });
    }

    // Add follower/following and save both documents
    req.user.following = Array.from(new Set([...(req.user.following || []).map(i => i.toString()), targetId]));
    target.followers = Array.from(new Set([...(target.followers || []).map(i => i.toString()), meId]));

    // Save in parallel
    await Promise.all([req.user.save(), target.save()]);

    // create activity
    await createActivity('follow', req.user._id, target._id, null, `${req.user.username} followed ${target.username}`);

    res.json({ message: 'Successfully followed user' });
  } catch (err) {
    console.error(`POST /api/users/${req.params.id}/follow error:`, err);
    res.status(400).json({ error: err.message || 'Unknown error' });
  }
});

// Unfollow
routerUsers.post('/:id/unfollow', auth, async (req, res) => {
  try {
    const target = await UserModel.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    const meId = req.user._id.toString();
    const targetId = target._id.toString();

    req.user.following = (req.user.following || []).filter(id => id.toString() !== targetId);
    target.followers = (target.followers || []).filter(id => id.toString() !== meId);

    await Promise.all([req.user.save(), target.save()]);

    res.json({ message: 'Successfully unfollowed user' });
  } catch (err) {
    console.error(`POST /api/users/${req.params.id}/unfollow error:`, err);
    res.status(400).json({ error: err.message || 'Unknown error' });
  }
});

// Block
routerUsers.post('/:id/block', auth, async (req, res) => {
  try {
    const target = await UserModel.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    const meId = req.user._id.toString();
    const targetId = target._id.toString();

    if (meId === targetId) return res.status(400).json({ error: 'Cannot block yourself' });

    if ((req.user.blockedUsers || []).some(b => b.toString() === targetId)) {
      return res.status(400).json({ error: 'User already blocked' });
    }

    req.user.blockedUsers = Array.from(new Set([...(req.user.blockedUsers || []).map(i => i.toString()), targetId]));
    await req.user.save();

    res.json({ message: 'User blocked successfully' });
  } catch (err) {
    console.error(`POST /api/users/${req.params.id}/block error:`, err);
    res.status(400).json({ error: err.message || 'Unknown error' });
  }
});

// Unblock
routerUsers.post('/:id/unblock', auth, async (req, res) => {
  try {
    const targetId = req.params.id.toString();
    req.user.blockedUsers = (req.user.blockedUsers || []).filter(id => id.toString() !== targetId);
    await req.user.save();
    res.json({ message: 'User unblocked successfully' });
  } catch (err) {
    console.error(`POST /api/users/${req.params.id}/unblock error:`, err);
    res.status(400).json({ error: err.message || 'Unknown error' });
  }
});

module.exports = routerUsers;
