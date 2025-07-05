const express = require('express');
const router = express.Router();
const { Comment } = require('./models');

// Example: Redirect /api/forumcomment/redirect to /api/forum/forum
router.get('/redirect', (req, res) => {
  res.redirect('/api/forum/forum');
});

// POST /add - Add a new comment
router.post('/add', async (req, res) => {
  try {
    const { forumId, addedTime, replyTo, content, userId } = req.body;
    if (!forumId || !content || !userId) {
      return res.status(400).json({ success: false, message: 'forumId, content, and userId are required.' });
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
    console.error('Error adding comment:', err);
    res.status(500).json({ success: false, message: 'Failed to add comment.' });
  }
});

// GET /by-forum/:forumId - Fetch top-level comments for a forum
router.get('/by-forum/:forumId', async (req, res) => {
  try {
    const { forumId } = req.params;
    if (!forumId) {
      return res.status(400).json({ success: false, message: 'forumId is required.' });
    }
    const comments = await Comment.find({ forumId, replyTo: null }).sort({ addedTime: 1 });
    res.json({ success: true, comments });
  } catch (err) {
    console.error('Error fetching comments:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch comments.' });
  }
});

// GET /all-forum-comments/:forumId - Fetch all comments for a forum (including replies)
router.get('/all-forum-comments/:forumId', async (req, res) => {
  try {
    const { forumId } = req.params;
    if (!forumId) {
      return res.status(400).json({ success: false, message: 'forumId is required.' });
    }
    const comments = await Comment.find({ forumId }).sort({ addedTime: 1 });
    res.json({ success: true, comments });
  } catch (err) {
    console.error('Error fetching all comments:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch all comments.' });
  }
});

// DELETE /:commentId - Delete a comment by ID
router.delete('/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;
    if (!commentId) {
      return res.status(400).json({ success: false, message: 'commentId is required.' });
    }

    // Find the comment first to check if it exists
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found.' });
    }

    // Delete the comment
    await Comment.findByIdAndDelete(commentId);
    
    res.json({ success: true, message: 'Comment deleted successfully.' });
  } catch (err) {
    console.error('Error deleting comment:', err);
    res.status(500).json({ success: false, message: 'Failed to delete comment.' });
  }
});

module.exports = router; 