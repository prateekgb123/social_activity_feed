const path = require('path');
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');


const app = express();
app.use(cors());
app.use(express.json());


const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/socialapp';
const FRONTEND_DIR = process.env.FRONTEND_DIR || path.join(__dirname, '..', 'frontend');
const PORT = process.env.PORT || 5000;


// Connect DB
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));


// Mount routers
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const postsRouter = require('./routes/posts');
const activitiesRouter = require('./routes/activities');
const adminRouter = require('./routes/admin');


app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/posts', postsRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/admin', adminRouter);


// Simple health endpoint
app.get('/api/test', (req, res) => res.json({ message: 'API is working!' }));


// Serve frontend static files
app.use(express.static(FRONTEND_DIR));
app.get('*', (req, res, next) => {
if (req.path.startsWith('/api')) return next();
res.sendFile(path.join(FRONTEND_DIR, 'index.html'), (err) => {
if (err) return res.status(404).send('Not found');
});
});


app.listen(PORT, () => console.log(`✅ Server running on port ${PORT} — serving static from ${FRONTEND_DIR}`));

