/**
 * Chat Routes
 * 
 * This module handles chat-related API endpoints for retrieving messages
 * and managing user connections for the chat system.
 * 
 * Features:
 * - Retrieve chat messages between users
 * - Get mutual connections (matched users)
 * - Message pagination and filtering
 * - User relationship management
 * 
 * @author Saath Team
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const { Message, Customer } = require('./models');
const mongoose = require('mongoose');

// ============================================================================
// BASIC ROUTES
// ============================================================================

/**
 * Chat Route Status
 * GET /api/chat
 * 
 * Returns the status of the chat routing system.
 * 
 * @returns {Object} Chat route status and version information
 */
router.get('/', (req, res) => {
  res.json({ 
    message: 'Chat route ready',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// MESSAGE MANAGEMENT ROUTES
// ============================================================================

/**
 * Get Chat Messages Between Users
 * GET /api/chat/messages
 * 
 * Retrieves chat messages between two users with pagination support.
 * Messages are returned in chronological order.
 * 
 * Query Parameters:
 * @param {string} user1 - First user ID
 * @param {string} user2 - Second user ID
 * @param {number} limit - Maximum number of messages to return (default: 30)
 * @param {string} before - Timestamp to fetch messages before (for pagination)
 * 
 * @returns {Array} Array of chat messages
 */
router.get('/messages', async (req, res) => {
  const { user1, user2, limit = 30, before } = req.query;
  
  if (!user1 || !user2) {
    return res.status(400).json({ error: 'Both user1 and user2 are required' });
  }
  
  try {
    // Build query to find messages between the two users
    const query = {
      $or: [
        { sender: user1, recipient: user2 },
        { sender: user2, recipient: user1 }
      ]
    };
    
    // Add timestamp filter for pagination if 'before' parameter is provided
    if (before) {
      query.timestamp = { $lt: new Date(before) };
    }
    
    // Fetch messages from database
    let messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .limit(Number(limit));
    
    // Reverse to get chronological order (oldest first)
    messages = messages.reverse();
    
    res.json(messages);
  } catch (err) {
    console.error('Error fetching chat messages:', err.message);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// ============================================================================
// USER CONNECTION ROUTES
// ============================================================================

/**
 * Get Mutual Connections for User
 * GET /api/chat/mutual-connections/:userId
 * 
 * Retrieves users who have mutual connections (both users follow each other).
 * These represent users who can chat with each other.
 * 
 * @param {string} userId - User ID to find mutual connections for
 * @returns {Object} Array of mutual connections with user details
 */
router.get('/mutual-connections/:userId', async (req, res) => {
  const { userId } = req.params;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  
  try {
    // Find the user and their followers/following
    const user = await Customer.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get users who are mutual followers (both users follow each other)
    const mutualConnections = [];
    
    // Check each user that the current user follows
    for (const followedUserId of user.followed) {
      const followedUser = await Customer.findById(followedUserId);
      if (followedUser) {
        // Check if the followed user also follows the current user
        const isMutual = followedUser.followed.some(id => id.toString() === userId.toString());
        
        if (isMutual) {
          // This is a mutual connection (both users follow each other)
          mutualConnections.push({
            _id: followedUser._id,
            name: followedUser.name || 'Unknown User',
            picture: followedUser.picture,
            email: followedUser.email,
            phone: followedUser.phone,
          });
        }
      }
    }
    
    res.json({
      success: true,
      data: {
        mutualConnections: mutualConnections
      }
    });
  } catch (err) {
    console.error('Error fetching mutual connections:', err.message);
    res.status(500).json({ error: 'Failed to fetch mutual connections' });
  }
});

// ============================================================================
// DEVELOPMENT ROUTES (REMOVE IN PRODUCTION)
// ============================================================================

/**
 * Test User Data Structure (Development Only)
 * GET /api/chat/test-users
 * 
 * Tests and displays user data structure for debugging purposes.
 * This route should be removed in production.
 * 
 * @returns {Object} User data structure information
 */
router.get('/test-users', async (req, res) => {
  try {
    const user1 = await Customer.findById('68735ced2dd65cb3a1d2fe8f');
    const user2 = await Customer.findById('68735d102dd65cb3a1d2fe9a');
    
    res.json({
      user1: {
        _id: user1?._id,
        name: user1?.name,
        followed: user1?.followed,
        follower: user1?.follower,
        followedTypes: user1?.followed?.map(id => typeof id),
        followerTypes: user1?.follower?.map(id => typeof id)
      },
      user2: {
        _id: user2?._id,
        name: user2?.name,
        followed: user2?.followed,
        follower: user2?.follower,
        followedTypes: user2?.followed?.map(id => typeof id),
        followerTypes: user2?.follower?.map(id => typeof id)
      }
    });
  } catch (err) {
    console.error('Error in test-users endpoint:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 