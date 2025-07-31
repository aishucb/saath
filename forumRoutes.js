/**
 * Forum Routes
 * 
 * This module handles forum-related API endpoints for community discussions,
 * user relationships, and content management.
 * 
 * Features:
 * - Forum post creation and management (admin only)
 * - User follow/unfollow relationships
 * - User listing and filtering
 * - Forum post retrieval and editing
 * 
 * @author Saath Team
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Customer, Admin, Forum } = require('./models');

// Verify models are properly loaded
if (!Customer || !Admin || !Forum) {
  console.error('Error: Models not properly initialized');
  process.exit(1);
}

// Import admin authentication middleware
const adminAuth = require('./middleware/auth');

// ============================================================================
// USER RELATIONSHIP ROUTES
// ============================================================================

/**
 * Follow User
 * POST /api/forum/follow
 * 
 * Creates a follow relationship between two users.
 * User id1 will follow user id2.
 * 
 * @param {string} id1 - ID of the user who wants to follow
 * @param {string} id2 - ID of the user to be followed
 * @returns {Object} Success confirmation
 */
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
    console.error('Error updating follow relationship:', error.message);
    res.status(500).json({ error: 'Failed to update follow relationship', details: error.message });
  }
});

/**
 * Unfollow User
 * POST /api/forum/unfollow
 * 
 * Removes a follow relationship between two users.
 * User id1 will unfollow user id2.
 * 
 * @param {string} id1 - ID of the user who wants to unfollow
 * @param {string} id2 - ID of the user to be unfollowed
 * @returns {Object} Success confirmation
 */
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
    console.error('Error updating unfollow relationship:', error.message);
    res.status(500).json({ error: 'Failed to update unfollow relationship', details: error.message });
  }
});

/**
 * Get All Users (Excluding Current User)
 * GET /api/forum/users
 * 
 * Retrieves all users except the specified user.
 * Useful for displaying potential connections or forum participants.
 * 
 * Query Parameters:
 * @param {string} excludeUserId - User ID to exclude from results
 * @returns {Object} Array of users
 */
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
    console.error('Error fetching users:', error.message);
    res.status(500).json({ error: 'Failed to fetch users', details: error.message });
  }
});

// ============================================================================
// BASIC ROUTES
// ============================================================================

/**
 * Hello Endpoint
 * GET /api/forum/hello
 * 
 * Simple test endpoint to verify forum routes are working.
 * 
 * @returns {Object} Hello message
 */
router.get('/hello', (req, res) => {
  res.json({ message: 'Hello from forumRoutes!' });
});

// ============================================================================
// FORUM POST MANAGEMENT ROUTES (ADMIN ONLY)
// ============================================================================

/**
 * Create Forum Post
 * POST /api/forum
 * 
 * Creates a new forum post. Only accessible by authenticated admins.
 * 
 * @param {string} title - Post title
 * @param {string} body - Post content
 * @param {Array} tags - Array of tags for categorization
 * @returns {Object} Created forum post
 */
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
    console.error('Error adding forum post:', error.message);
    res.status(500).json({ error: 'Failed to add forum post', details: error.message });
  }
});

/**
 * Edit Forum Post
 * PUT /api/forum/:id
 * 
 * Updates an existing forum post. Only accessible by authenticated admins.
 * 
 * @param {string} id - Forum post ID
 * @param {string} title - Updated post title (optional)
 * @param {string} body - Updated post content (optional)
 * @param {Array} tags - Updated array of tags (optional)
 * @returns {Object} Updated forum post
 */
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
    console.error('Error updating forum post:', error.message);
    res.status(500).json({ error: 'Failed to update forum post', details: error.message });
  }
});

// ============================================================================
// FORUM POST RETRIEVAL ROUTES (PUBLIC)
// ============================================================================

/**
 * Get All Forum Posts
 * GET /api/forum
 * 
 * Retrieves all forum posts sorted by creation date (newest first).
 * 
 * @returns {Object} Array of forum posts
 */
router.get('/', async (req, res) => {
  try {
    const forums = await Forum.find().sort({ createdAt: -1 });
    res.json({ success: true, forums });
  } catch (error) {
    console.error('Error fetching forums:', error.message);
    res.status(500).json({ error: 'Failed to fetch forums', details: error.message });
  }
});

/**
 * Get Forum Posts by Admin
 * GET /api/forum/admin/:adminId
 * 
 * Retrieves all forum posts created by a specific admin.
 * 
 * @param {string} adminId - Admin ID to filter posts by
 * @returns {Object} Array of forum posts and admin information
 */
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
    console.error('Error fetching forums by admin:', error.message);
    res.status(500).json({ error: 'Failed to fetch forums by admin', details: error.message });
  }
});

/**
 * Get Single Forum Post
 * GET /api/forum/forum/:id
 * 
 * Retrieves a single forum post by its ID.
 * 
 * @param {string} id - Forum post ID
 * @returns {Object} Forum post details
 */
router.get('/forum/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const forumPost = await Forum.findById(id);
    
    if (!forumPost) {
      return res.status(404).json({ error: 'Forum post not found' });
    }
    
    res.json({ success: true, forumPost });
  } catch (error) {
    console.error('Error fetching forum post:', error.message);
    res.status(500).json({ error: 'Failed to fetch forum post', details: error.message });
  }
});

/**
 * Delete Forum Post
 * DELETE /api/forum/forum/:id
 * 
 * Deletes a forum post by its ID.
 * 
 * @param {string} id - Forum post ID
 * @returns {Object} Deletion confirmation
 */
router.delete('/forum/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Forum.findByIdAndDelete(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Forum post not found' });
    }
    
    res.json({ success: true, message: 'Forum post deleted' });
  } catch (error) {
    console.error('Error deleting forum post:', error.message);
    res.status(500).json({ error: 'Failed to delete forum post', details: error.message });
  }
});

module.exports = router;
