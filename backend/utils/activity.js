const Activity = require('../models/Activity');
async function createActivity(type, userId, targetUserId=null, postId=null, message='') {
try {
const activity = new Activity({ type, user: userId, targetUser: targetUserId, post: postId, message });
await activity.save();
} catch (e) {
console.error('createActivity err', e);
}
}
module.exports = { createActivity };

