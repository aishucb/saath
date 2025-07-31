/**
 * Followers Routes
 * 
 * This module handles user relationship management including following,
 * unfollowing, and finding potential matches based on mutual interests.
 * 
 * Features:
 * - User following/unfollowing system
 * - Potential match discovery
 * - Mutual connection detection
 * - User relationship statistics
 * 
 * @author Saath Team
 * @version 1.0.1
 */

const express = require('express');
const router = express.Router();
const { Customer } = require('./models');
const mongoose = require('mongoose');

// ============================================================================
// BASIC ROUTES
// ============================================================================

/**
 * Followers Route Status
 * GET /followers
 * 
 * Returns the status of the followers routing system.
 * 
 * @returns {Object} Followers route status and version information
 */
router.get('/', (req, res) => {
  res.json({ 
    message: 'Followers routing is active',
    version: '1.0.1',
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// USER RETRIEVAL ROUTES
// ============================================================================

/**
 * Get All Users
 * GET /followers/all-users
 * 
 * Retrieves all users, optionally excluding a specific user by ID.
 * 
 * Query Parameters:
 * @param {string} excludeId - User ID to exclude from results (optional)
 * @returns {Array} Array of users
 */
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
    console.error('Error fetching users:', err.message);
    res.status(500).json({ error: 'Failed to fetch users', details: err.message });
  }
});

// ============================================================================
// MATCHING AND RELATIONSHIP ROUTES
// ============================================================================

/**
 * Get Potential Matches for User
 * GET /followers/potential-matches/:userId
 * 
 * Finds potential matches for a user based on mutual following relationships.
 * Prioritizes users who have shown interest (followed the current user).
 * 
 * @param {string} userId - ID of the user to find matches for
 * @returns {Object} Array of potential matches with metadata and statistics
 */
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
    console.error('Error fetching potential matches:', err.message);
    res.status(500).json({ error: 'Failed to fetch potential matches', details: err.message });
  }
});

/**
 * Follow User
 * POST /followers/follow
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
    console.error('Error updating follow relationship:', error.message);
    res.status(500).json({ error: 'Failed to update follow relationship', details: error.message });
  }
});

/**
 * Unfollow User
 * POST /followers/unfollow
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
    console.error('Error updating unfollow relationship:', error.message);
    res.status(500).json({ error: 'Failed to update unfollow relationship', details: error.message });
  }
});

module.exports = router; 