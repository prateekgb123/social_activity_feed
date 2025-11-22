const mongoose3 = require('mongoose');
const activitySchema = new mongoose3.Schema({
type: { type: String, required: true },
user: { type: mongoose3.Schema.Types.ObjectId, ref: 'User' },
targetUser: { type: mongoose3.Schema.Types.ObjectId, ref: 'User' },
post: { type: mongoose3.Schema.Types.ObjectId, ref: 'Post' },
message: { type: String, required: true },
createdAt:{ type: Date, default: Date.now }
});
module.exports = mongoose3.model('Activity', activitySchema);