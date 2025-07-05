const express = require('express');
const router = express.Router();
const { Customer } = require('./models');
const mongoose = require('mongoose');

// Route to indicate followers routing is active
router.get('/', (req, res) => {
  res.send('Followers routing is active');
});

// Fetch all users, optionally excluding one by id
router.get('/all-users', async (req, res) => {
  try {
    const excludeId = req.query.excludeId;
    let users;
    if (excludeId) {
      users = await Customer.find({ _id: { $ne: excludeId } });
    } else {
      users = await Customer.find();
    }
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users', details: err.message });
  }
});

// Get users who followed the current user (potential matches)
router.get('/potential-matches/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const excludeId = req.query.excludeId;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    let objectId;
    try {
      objectId = new mongoose.Types.ObjectId(userId);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    
    // Get the current user to see who followed them
    const currentUser = await Customer.findById(objectId);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get users who followed the current user
    const followers = currentUser.follower || [];
    
    // Get users who the current user is following
    const following = currentUser.followed || [];
    
    // Find mutual follows (both following each other)
    const mutualFollows = followers.filter(followerId => 
      following.some(followingId => followerId.toString() === followingId.toString())
    );
    
    // Get potential matches: users who followed current user but current user hasn't followed back
    const potentialMatchIds = followers.filter(followerId => 
      !mutualFollows.includes(followerId)
    );
    
    // Get all users except current user, mutual follows, and users already liked (followed)
    const allUsers = await Customer.find({ 
      _id: { 
        $ne: objectId,
        $nin: [...mutualFollows, ...following] // Exclude mutual follows and already liked users
      }
    });
    
    // Separate potential matches from other users
    const potentialMatches = allUsers.filter(user => 
      potentialMatchIds.some(id => id.toString() === user._id.toString())
    );
    
    const otherUsers = allUsers.filter(user => 
      !potentialMatchIds.some(id => id.toString() === user._id.toString())
    );
    
    // Combine: potential matches first, then other users
    const combinedUsers = [...potentialMatches, ...otherUsers];
    
    // Add metadata to each user
    const usersWithMetadata = combinedUsers.map(user => {
      const isPotentialMatch = potentialMatchIds.some(id => id.toString() === user._id.toString());
      return {
        ...user.toObject(),
        isPotentialMatch,
        showedInterest: isPotentialMatch
      };
    });
    
    res.json({
      users: usersWithMetadata,
      stats: {
        potentialMatches: potentialMatches.length,
        totalUsers: combinedUsers.length,
        mutualFollows: mutualFollows.length
      }
    });
    
  } catch (err) {
    console.error('Error fetching potential matches:', err);
    res.status(500).json({ error: 'Failed to fetch potential matches', details: err.message });
  }
});

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
    // Update id2: add id1 to follower array (people who liked id2)
    await Customer.updateOne(
      { _id: objectId2 },
      { $addToSet: { follower: objectId1 } }
    );
    // Update id1: add id2 to followed array (people id1 liked)
    await Customer.updateOne(
      { _id: objectId1 },
      { $addToSet: { followed: objectId2 } }
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
    // Update id2: remove id1 from follower array (people who liked id2)
    await Customer.updateOne(
      { _id: objectId2 },
      { $pull: { follower: objectId1 } }
    );
    // Update id1: remove id2 from followed array (people id1 liked)
    await Customer.updateOne(
      { _id: objectId1 },
      { $pull: { followed: objectId2 } }
    );
    res.json({ success: true, message: 'Unfollow relationship updated' });
  } catch (error) {
    console.error('Error updating unfollow relationship:', error);
    res.status(500).json({ error: 'Failed to update unfollow relationship', details: error.message });
  }
});

module.exports = router; 