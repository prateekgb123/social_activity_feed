const mongoose2 = require('mongoose');
const postSchema = new mongoose2.Schema({
content: { type: String, required: true },
author: { type: mongoose2.Schema.Types.ObjectId, ref: 'User', required: true },
likes: [{ type: mongoose2.Schema.Types.ObjectId, ref: 'User' }],
createdAt:{ type: Date, default: Date.now }
});
module.exports = mongoose2.model('Post', postSchema);