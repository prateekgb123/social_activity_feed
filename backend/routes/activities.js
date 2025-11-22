const express7 = require('express');
const routerActivities = express7.Router();
const ActivityModel = require('../models/Activity');
const { auth } = require('../middleware/auth');


routerActivities.get('/', auth, async (req, res) => {
try {
const activities = await ActivityModel.find().populate('user', 'username').populate('targetUser', 'username').populate('post', 'content').sort({ createdAt: -1 }).limit(50);
res.json(activities);
} catch (err) {
res.status(400).json({ error: err.message });
}
});


module.exports = routerActivities;