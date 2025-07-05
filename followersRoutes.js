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

module.exports = router; 