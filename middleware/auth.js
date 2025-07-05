const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { Admin } = require('../models');

module.exports = async function(req, res, next) {
  // Get token from header
  const token = req.header('x-auth-token');

  // Check if no token
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    let adminId = decoded.admin?._id || decoded.admin?.id || decoded._id || decoded.id;
    if (!adminId) {
      return res.status(401).json({ message: 'Token does not contain admin id' });
    }
    // Fetch the full admin object from DB
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(401).json({ message: 'Admin not found' });
    }
    req.admin = admin;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};