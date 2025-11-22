// routes/posts.js
const express = require('express');
const routerPosts = express.Router();

const PostModel = require('../models/Post');
const { auth } = require('../middleware/auth');
const { createActivity: createActivity3 } = require('../utils/activity');

// Create post
routerPosts.post('/', auth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Post content required' });

    const post = new PostModel({ content, author: req.user._id });
    await post.save();
    await post.populate('author', 'username');
    await createActivity3('post', req.user._id, null, post._id, `${req.user.username} made a post`);
    res.status(201).json(post);
  } catch (err) {
    console.error('POST /api/posts error:', err);
    res.status(400).json({ error: err.message || 'Unknown error' });
  }
});

// Get posts (exclude posts from blocked users)
routerPosts.get('/', auth, async (req, res) => {
  try {
    const posts = await PostModel.find({ author: { $nin: req.user.blockedUsers } })
      .populate('author', 'username')
      .populate('likes', 'username')
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (err) {
    console.error('GET /api/posts error:', err);
    res.status(400).json({ error: err.message || 'Unknown error' });
  }
});

// Delete a post (author only)
routerPosts.delete('/:id', auth, async (req, res) => {
  try {
    const post = await PostModel.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    // Compare as strings to avoid .equals issues if types differ
    if (post.author && post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await PostModel.findByIdAndDelete(req.params.id);
    res.json({ message: 'Post deleted successfully' });
  } catch (err) {
    console.error(`DELETE /api/posts/${req.params.id} error:`, err);
    res.status(400).json({ error: err.message || 'Unknown error' });
  }
});

// Like a post
routerPosts.post('/:id/like', auth, async (req, res) => {
  try {
    const post = await PostModel.findById(req.params.id).populate('author', 'username');
    if (!post) return res.status(404).json({ error: 'Post not found' });

    // Check existing like by string comparison
    if (post.likes.some(l => l.toString() === req.user._id.toString())) {
      return res.status(400).json({ error: 'Already liked this post' });
    }

    post.likes.push(req.user._id);
    await post.save();

    // ensure createActivity3 exists and is imported
    await createActivity3('like', req.user._id, null, post._id, `${req.user.username} liked ${post.author?.username || 'a user'}'s post`);
    res.json({ message: 'Post liked successfully' });
  } catch (err) {
    console.error(`POST /api/posts/${req.params.id}/like error:`, err);
    res.status(400).json({ error: err.message || 'Unknown error' });
  }
});

// Unlike a post
routerPosts.post('/:id/unlike', auth, async (req, res) => {
  try {
    const post = await PostModel.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    post.likes = post.likes.filter(id => id.toString() !== req.user._id.toString());
    await post.save();

    res.json({ message: 'Post unliked successfully' });
  } catch (err) {
    console.error(`POST /api/posts/${req.params.id}/unlike error:`, err);
    res.status(400).json({ error: err.message || 'Unknown error' });
  }
});

module.exports = routerPosts;
