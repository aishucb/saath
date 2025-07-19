const express = require('express');
const router = express.Router();
const { Message, Customer } = require('./models');
const mongoose = require('mongoose');

// Route to indicate chat routing is ready
router.get('/', (req, res) => {
  res.json({ 
    message: 'Chat route ready',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Get chat messages between two users
// GET /api/chat/messages?user1=...&user2=...
router.get('/messages', async (req, res) => {
  const { user1, user2 } = req.query;
  if (!user1 || !user2) {
    return res.status(400).json({ error: 'Both user1 and user2 are required' });
  }
  try {
    const messages = await Message.find({
      $or: [
        { sender: user1, recipient: user2 },
        { sender: user2, recipient: user1 }
      ]
    })
      .sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Test endpoint to check user data structure
// GET /api/chat/test-users
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
    res.status(500).json({ error: err.message });
  }
});

// Get mutual connections for a user (users who have matched)
// GET /api/chat/mutual-connections/:userId
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
    
    console.log('User:', user.name);
    console.log('User followed:', user.followed);
    console.log('User follower:', user.follower);
    
    // Get users who are mutual followers (both users follow each other)
    const mutualConnections = [];
    
    // Check each user that the current user follows
    for (const followedUserId of user.followed) {
      const followedUser = await Customer.findById(followedUserId);
      if (followedUser) {
        console.log('Checking user:', followedUser.name);
        console.log('Their followed:', followedUser.followed);
        console.log('Looking for userId:', userId);
        
        // Check if the followed user also follows the current user
        const isMutual = followedUser.followed.some(id => id.toString() === userId.toString());
        console.log('Is mutual:', isMutual);
        
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
    
    console.log('Final mutual connections:', mutualConnections);
    
    res.json({
      success: true,
      data: {
        mutualConnections: mutualConnections
      }
    });
  } catch (err) {
    console.error('Error fetching mutual connections:', err);
    res.status(500).json({ error: 'Failed to fetch mutual connections' });
  }
});

module.exports = router; 