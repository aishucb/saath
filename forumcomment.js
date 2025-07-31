/**
 * Forum Comment Routes
 * 
 * This module handles forum comment-related API endpoints for managing
 * comments on forum posts, including nested replies.
 * 
 * Features:
 * - Add comments to forum posts
 * - Retrieve comments with pagination
 * - Nested comment replies
 * - Comment deletion
 * 
 * @author Saath Team
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const { Comment } = require('./models');

// ============================================================================
// BASIC ROUTES
// ============================================================================

/**
 * Redirect Endpoint
 * GET /api/forumcomment/redirect
 * 
 * Redirects to the forum posts endpoint.
 * 
 * @returns {Redirect} Redirects to /api/forum/forum
 */
router.get('/redirect', (req, res) => {
  res.redirect('/api/forum/forum');
});

// ============================================================================
// COMMENT MANAGEMENT ROUTES
// ============================================================================

/**
 * Add New Comment
 * POST /api/forumcomment/add
 * 
 * Creates a new comment on a forum post. Supports nested replies.
 * 
 * @param {string} forumId - ID of the forum post
 * @param {string} content - Comment content
 * @param {string} userId - ID of the user creating the comment
 * @param {string} addedTime - Timestamp for the comment (optional)
 * @param {string} replyTo - ID of the comment being replied to (optional)
 * @returns {Object} Created comment details
 */
router.post('/add', async (req, res) => {
  try {
    const { forumId, addedTime, replyTo, content, userId } = req.body;
    
    if (!forumId || !content || !userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'forumId, content, and userId are required.' 
      });
    }
    
    const comment = new Comment({
      forumId,
      addedTime: addedTime ? new Date(addedTime) : undefined,
      replyTo: replyTo || null,
      content,
      userId
    });
    
    await comment.save();
    res.status(201).json({ success: true, comment });
  } catch (err) {
    console.error('Error adding comment:', err.message);
    res.status(500).json({ success: false, message: 'Failed to add comment.' });
  }
});

/**
 * Get Top-Level Comments for Forum
 * GET /api/forumcomment/by-forum/:forumId
 * 
 * Retrieves all top-level comments (not replies) for a specific forum post.
 * 
 * @param {string} forumId - ID of the forum post
 * @returns {Object} Array of top-level comments
 */
router.get('/by-forum/:forumId', async (req, res) => {
  try {
    const { forumId } = req.params;
    
    if (!forumId) {
      return res.status(400).json({ 
        success: false, 
        message: 'forumId is required.' 
      });
    }
    
    const comments = await Comment.find({ forumId, replyTo: null }).sort({ addedTime: 1 });
    res.json({ success: true, comments });
  } catch (err) {
    console.error('Error fetching comments:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch comments.' });
  }
});

/**
 * Get All Comments for Forum (Including Replies)
 * GET /api/forumcomment/all-forum-comments/:forumId
 * 
 * Retrieves all comments for a forum post, including nested replies.
 * 
 * @param {string} forumId - ID of the forum post
 * @returns {Object} Array of all comments and replies
 */
router.get('/all-forum-comments/:forumId', async (req, res) => {
  try {
    const { forumId } = req.params;
    
    if (!forumId) {
      return res.status(400).json({ 
        success: false, 
        message: 'forumId is required.' 
      });
    }
    
    const comments = await Comment.find({ forumId }).sort({ addedTime: 1 });
    res.json({ success: true, comments });
  } catch (err) {
    console.error('Error fetching all comments:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch all comments.' });
  }
});

/**
 * Delete Comment
 * DELETE /api/forumcomment/:commentId
 * 
 * Deletes a comment by its ID. This will also remove any replies to the comment.
 * 
 * @param {string} commentId - ID of the comment to delete
 * @returns {Object} Deletion confirmation
 */
router.delete('/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;
    
    if (!commentId) {
      return res.status(400).json({ 
        success: false, 
        message: 'commentId is required.' 
      });
    }

    // Find the comment first to check if it exists
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Comment not found.' 
      });
    }

    // Delete the comment
    await Comment.findByIdAndDelete(commentId);
    
    res.json({ success: true, message: 'Comment deleted successfully.' });
  } catch (err) {
    console.error('Error deleting comment:', err.message);
    res.status(500).json({ success: false, message: 'Failed to delete comment.' });
  }
});

module.exports = router; 