const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Customer, Admin, Forum } = require('./models');
// Verify models are loaded
if (!Customer || !Admin || !Forum) {
  console.error('Error: Models not properly initialized');
  process.exit(1);
}

// Root endpoint for testing
// router.get('/', (req, res) => {
//   res.json({ success: true, message: 'Forum API is working' });
// });

// Forum model is now imported from models.js
const adminAuth = require('./middleware/auth');

// Add follower/followed relationship between two users
router.post('/follow', async (req, res) => {
  try {
    const { id1, id2 } = req.body;
    if (!id1 || !id2) {
      return res.status(400).json({ error: 'Both id1 and id2 are required' });
    }
    let objectId1, objectId2;
    try {
      objectId1 = new mongoose.Types.ObjectId(id1);
      objectId2 = new mongoose.Types.ObjectId(id2);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid id format' });
    }
    // Update id1: add id2 to follower array
    await Customer.updateOne(
      { _id: objectId1 },
      { $addToSet: { follower: objectId2 } }
    );
    // Update id2: add id1 to followed array
    await Customer.updateOne(
      { _id: objectId2 },
      { $addToSet: { followed: objectId1 } }
    );
    res.json({ success: true, message: 'Follow relationship updated' });
  } catch (error) {
    console.error('Error updating follow relationship:', error);
    res.status(500).json({ error: 'Failed to update follow relationship', details: error.message });
  }
});

// Remove follower/followed relationship between two users
router.post('/unfollow', async (req, res) => {
  try {
    const { id1, id2 } = req.body;
    if (!id1 || !id2) {
      return res.status(400).json({ error: 'Both id1 and id2 are required' });
    }
    let objectId1, objectId2;
    try {
      objectId1 = new mongoose.Types.ObjectId(id1);
      objectId2 = new mongoose.Types.ObjectId(id2);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid id format' });
    }
    // Update id1: remove id2 from follower array
    await Customer.updateOne(
      { _id: objectId1 },
      { $pull: { follower: objectId2 } }
    );
    // Update id2: remove id1 from followed array
    await Customer.updateOne(
      { _id: objectId2 },
      { $pull: { followed: objectId1 } }
    );
    res.json({ success: true, message: 'Unfollow relationship updated' });
  } catch (error) {
    console.error('Error updating unfollow relationship:', error);
    res.status(500).json({ error: 'Failed to update unfollow relationship', details: error.message });
  }
});

// Fetch all users except the current user
router.get('/users', async (req, res) => {
  try {
    const { excludeUserId } = req.query;
    if (!excludeUserId) {
      return res.status(400).json({ error: 'excludeUserId query parameter is required' });
    }
    let excludeObjectId;
    try {
      excludeObjectId = new mongoose.Types.ObjectId(excludeUserId);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid excludeUserId format' });
    }
    // Exclude the user by _id
    const users = await Customer.find({ _id: { $ne: excludeObjectId } });
    res.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users', details: error.message });
  }
});

// Simple hello endpoint for testing
router.get('/hello', (req, res) => {
  res.json({ message: 'Hello from forumRoutes!' });
});

// Add a forum post (Admin only)
router.post('/', adminAuth, async (req, res) => {
  try {
    const { title, body, tags } = req.body;
    if (!title || !body || !Array.isArray(tags)) {
      return res.status(400).json({ error: 'title, body, and tags (array) are required' });
    }
    // Set createdBy to admin ID for consistent querying
    const createdBy = req.admin?._id || req.admin?.id || 'unknown';
    const forumPost = new Forum({ title, body, tags, createdBy, createdAt: new Date() });
    await forumPost.save();
    res.status(201).json({ success: true, forumPost });
  } catch (error) {
    console.error('Error adding forum post:', error);
    res.status(500).json({ error: 'Failed to add forum post', details: error.message });
  }
});

// Edit a forum post by _id (Admin only)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, body, tags } = req.body;
    // Only update fields provided
    const update = {};
    if (title !== undefined) update.title = title;
    if (body !== undefined) update.body = body;
    if (tags !== undefined) update.tags = tags;
    const updatedForum = await Forum.findByIdAndUpdate(id, update, { new: true });
    if (!updatedForum) {
      return res.status(404).json({ error: 'Forum post not found' });
    }
    res.json({ success: true, forumPost: updatedForum });
  } catch (error) {
    console.error('Error updating forum post:', error);
    res.status(500).json({ error: 'Failed to update forum post', details: error.message });
  }
});

// Fetch all forum posts (Public)
router.get('/', async (req, res) => {
  try {
    const forums = await Forum.find().sort({ createdAt: -1 });
    res.json({ success: true, forums });
  } catch (error) {
    console.error('Error fetching forums:', error);
    res.status(500).json({ error: 'Failed to fetch forums', details: error.message });
  }
});

// Fetch forums by specific admin
router.get('/admin/:adminId', async (req, res) => {
  try {
    const { adminId } = req.params;
    
    // First, find the admin to get their info
    const Admin = mongoose.models.Admin || mongoose.model('Admin');
    const admin = await Admin.findById(adminId);
    
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    
    // Find forums created by this admin - handle both old string format and new ObjectId format
    const forums = await Forum.find({
      $or: [
        { createdBy: adminId }, // New format (ObjectId reference)
        { createdBy: adminId.toString() } // Old format (string)
      ]
    }).populate('createdBy', 'name email').sort({ createdAt: -1 });
    
    res.json({ 
      success: true, 
      forums,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email
      }
    });
  } catch (error) {
    console.error('Error fetching forums by admin:', error);
    res.status(500).json({ error: 'Failed to fetch forums by admin', details: error.message });
  }
});

// Fetch a single forum post by _id
router.get('/forum/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const forumPost = await Forum.findById(id);
    if (!forumPost) {
      return res.status(404).json({ error: 'Forum post not found' });
    }
    res.json({ success: true, forumPost });
  } catch (error) {
    console.error('Error fetching forum post:', error);
    res.status(500).json({ error: 'Failed to fetch forum post', details: error.message });
  }
});

// Delete a forum post by _id
router.delete('/forum/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Forum.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Forum post not found' });
    }
    res.json({ success: true, message: 'Forum post deleted' });
  } catch (error) {
    console.error('Error deleting forum post:', error);
    res.status(500).json({ error: 'Failed to delete forum post', details: error.message });
  }
});

module.exports = router;
