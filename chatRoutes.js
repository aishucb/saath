const express = require('express');
const router = express.Router();
const { Customer } = require('./models');
const mongoose = require('mongoose');

// Route to indicate chat routing is ready
router.get('/', (req, res) => {
  res.json({ 
    message: 'Chat route ready',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// API to get mutual connections (users who follow each other)
router.get('/mutual-connections/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    let objectId;
    try {
      objectId = new mongoose.Types.ObjectId(userId);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    
    // Get the current user
    const currentUser = await Customer.findById(objectId);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get arrays of followers and following
    const followers = currentUser.follower || [];
    const following = currentUser.followed || [];
    
    console.log('User ID:', userId);
    console.log('Followers count:', followers.length);
    console.log('Following count:', following.length);
    console.log('Followers:', followers);
    console.log('Following:', following);
    
    // Find common users (mutual connections)
    const mutualConnectionIds = followers.filter(followerId => 
      following.some(followingId => followerId.toString() === followingId.toString())
    );
    
    console.log('Mutual connection IDs:', mutualConnectionIds);
    
    // Get details of mutual connection users
    const mutualConnections = await Customer.find({ 
      _id: { $in: mutualConnectionIds } 
    }).select('name email phone profilePicture bio');
    
    console.log('Found mutual connections:', mutualConnections.length);
    
    res.json({
      success: true,
      data: {
        userId: userId,
        userName: currentUser.name,
        mutualConnections: mutualConnections,
        stats: {
          totalFollowers: followers.length,
          totalFollowing: following.length,
          mutualConnections: mutualConnections.length
        }
      }
    });
    
  } catch (err) {
    console.error('Error fetching mutual connections:', err);
    res.status(500).json({ 
      error: 'Failed to fetch mutual connections', 
      details: err.message 
    });
  }
});

module.exports = router; 