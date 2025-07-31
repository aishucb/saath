/**
 * Authentication Middleware
 * 
 * This middleware validates JWT tokens for admin authentication.
 * It extracts the token from the request header, verifies it, and
 * fetches the corresponding admin user from the database.
 * 
 * Usage:
 * - Add to routes that require admin authentication
 * - Expects 'x-auth-token' header with valid JWT
 * - Sets req.admin with the authenticated admin object
 * 
 * @author Saath Team
 * @version 1.0.0
 */

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { Admin } = require('../models');

/**
 * Authentication Middleware Function
 * 
 * Validates JWT tokens and authenticates admin users.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
module.exports = async function(req, res, next) {
  // Extract token from request header
  const token = req.header('x-auth-token');

  // Check if token is provided
  if (!token) {
    return res.status(401).json({ 
      message: 'No token, authorization denied' 
    });
  }

  // Verify and decode the JWT token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    
    // Extract admin ID from various possible token structures
    let adminId = decoded.admin?._id || decoded.admin?.id || decoded._id || decoded.id;
    
    if (!adminId) {
      return res.status(401).json({ 
        message: 'Token does not contain admin id' 
      });
    }
    
    // Fetch the complete admin object from database
    const admin = await Admin.findById(adminId);
    
    if (!admin) {
      return res.status(401).json({ 
        message: 'Admin not found' 
      });
    }
    
    // Attach admin object to request for use in subsequent middleware/routes
    req.admin = admin;
    next();
  } catch (err) {
    // Handle JWT verification errors
    res.status(401).json({ 
      message: 'Token is not valid' 
    });
  }
};