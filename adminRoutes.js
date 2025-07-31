/**
 * Admin Routes
 * 
 * This module handles all admin-related API endpoints including authentication,
 * registration, and profile management for administrative users.
 * 
 * Features:
 * - Admin registration and login
 * - JWT-based authentication
 * - Profile management
 * - Password hashing and validation
 * 
 * @author Saath Team
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Admin Authentication Middleware
 * 
 * Validates JWT tokens for admin authentication.
 * Extracts admin information and attaches it to the request object.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
const auth = async (req, res, next) => {
    const requestId = Math.random().toString(36).substring(2, 8);
    
    try {
        // Extract authorization header
        const authHeader = req.header('Authorization');
        
        if (!authHeader) {
            return res.status(401).json({ 
                success: false, 
                message: 'No token provided'
            });
        }

        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid token format'
            });
        }

        const token = authHeader.replace('Bearer ', '').trim();
        
        try {
            // Verify JWT token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
            
            // Extract admin ID from various possible token structures
            const adminId = decoded._id || 
                           (decoded.admin && decoded.admin.id) || 
                           decoded.id || 
                           (decoded.admin && decoded.admin._id);

            if (!adminId) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Admin not found' 
                });
            }
            
            // Find admin by ID
            const admin = await Admin.findById(adminId).select('-password');
            if (!admin) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Admin not found' 
                });
            }
            
            // Attach admin to request
            req.admin = admin;
            req.requestId = requestId;
            
            next();
        } catch (error) {
            const errorMessage = error.name === 'TokenExpiredError' 
                ? 'Token has expired' 
                : 'Invalid token';
            
            return res.status(401).json({ 
                success: false, 
                message: errorMessage
            });
        }
    } catch (err) {
        console.error('Unexpected error in auth middleware:', err.message);
        
        res.status(500).json({
            success: false,
            message: 'Authentication failed',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined,
            requestId: requestId || 'unknown',
            timestamp: new Date().toISOString()
        });
    }
};

// ============================================================================
// ADMIN MODEL
// ============================================================================

// Constants
const saltRounds = 10;

/**
 * Admin Schema
 * 
 * Defines the structure for admin users with email validation,
 * password requirements, and automatic password hashing.
 * 
 * @field email - Unique email address with validation
 * @field password - Hashed password with minimum length
 * @field name - Admin display name
 * @field createdAt - Account creation timestamp
 */
const adminSchema = new mongoose.Schema({
    email: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address']
    },
    password: { 
        type: String, 
        required: true,
        minlength: 6
    },
    name: { 
        type: String, 
        required: true,
        trim: true
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

/**
 * Pre-save Middleware for Password Hashing
 * 
 * Automatically hashes passwords before saving to the database.
 */
adminSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    next();
});

// Create Admin model if it doesn't exist
const Admin = mongoose.models.Admin || mongoose.model('Admin', adminSchema, 'Admins');

// ============================================================================
// BASIC ROUTES
// ============================================================================

/**
 * Hello Endpoint
 * GET /api/admin/hello
 * 
 * Simple test endpoint to verify admin routes are working.
 * 
 * @returns {Object} Hello message
 */
router.get('/hello', (req, res) => {
    res.json({ message: 'Hello from admin routes!' });
});

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================

/**
 * Register New Admin
 * POST /api/admin/register
 * 
 * Creates a new admin account with email validation and password hashing.
 * This endpoint should be protected in production environments.
 * 
 * @param {string} email - Admin email address
 * @param {string} password - Admin password (minimum 6 characters)
 * @param {string} name - Admin display name
 * @returns {Object} Registration confirmation and admin details
 */
router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        // Validate required fields
        if (!email || !password || !name) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please provide all required fields (email, password, name)' 
            });
        }

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ email });
        if (existingAdmin) {
            return res.status(400).json({ 
                success: false, 
                message: 'Admin with this email already exists' 
            });
        }

        // Create new admin (password will be hashed by pre-save hook)
        const admin = new Admin({
            email,
            password,
            name
        });

        // Save to database
        await admin.save();

        // Remove password from response
        const adminResponse = admin.toObject();
        delete adminResponse.password;

        res.status(201).json({
            success: true,
            message: 'Admin registered successfully',
            admin: adminResponse
        });

    } catch (error) {
        console.error('Error in admin registration:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during registration',
            error: error.message 
        });
    }
});

/**
 * Admin Login
 * POST /api/admin/login
 * 
 * Authenticates admin credentials and returns a JWT token for subsequent requests.
 * 
 * @param {string} email - Admin email address
 * @param {string} password - Admin password
 * @returns {Object} JWT token and admin information
 */
router.post('/login', async (req, res) => {
    const requestId = Math.random().toString(36).substring(2, 8);
    
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please provide both email and password',
                requestId
            });
        }

        // Check if admin exists
        let admin;
        try {
            admin = await Admin.findOne({ email }).select('+password').lean();
        } catch (dbError) {
            console.error('Database error during login:', dbError);
            return res.status(500).json({
                success: false,
                message: 'Database error',
                error: dbError.message,
                requestId
            });
        }

        if (!admin) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid credentials',
                requestId
            });
        }

        // Verify password
        let isMatch = false;
        try {
            isMatch = await bcrypt.compare(password, admin.password);
        } catch (bcryptError) {
            console.error('Bcrypt error during login:', bcryptError);
            return res.status(500).json({
                success: false,
                message: 'Authentication error',
                error: bcryptError.message,
                requestId
            });
        }

        if (!isMatch) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid credentials',
                requestId
            });
        }

        try {
            // Create token payload
            const payload = {
                id: admin._id.toString(),
                email: admin.email,
                name: admin.name,
                role: 'admin'
            };

            // Sign JWT token
            const token = jwt.sign(
                payload,
                process.env.JWT_SECRET || 'your_jwt_secret',
                { expiresIn: '24h' }
            );

            // Remove password from response
            const { password: _, ...adminWithoutPassword } = admin;
            
            res.json({
                success: true,
                token: token, // Return token without 'Bearer ' prefix
                admin: adminWithoutPassword,
                requestId
            });
        } catch (tokenError) {
            console.error('Token generation error:', tokenError);
            return res.status(500).json({
                success: false,
                message: 'Error generating authentication token',
                error: tokenError.message,
                requestId
            });
        }

    } catch (error) {
        console.error('Login error:', error.message);
        
        // Don't expose internal errors in production
        const errorMessage = process.env.NODE_ENV === 'development' 
            ? error.message 
            : 'An error occurred during login';
            
        res.status(500).json({ 
            success: false, 
            message: 'Server error during login',
            error: errorMessage,
            requestId: requestId,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Get Current Admin Profile
 * GET /api/admin/me
 * 
 * Retrieves the current admin's profile information.
 * Requires authentication via Authorization header.
 * 
 * @returns {Object} Admin profile information
 */
router.get('/me', auth, async (req, res) => {
    const requestId = req.requestId || Math.random().toString(36).substring(2, 8);
    
    try {
        if (!req.admin) {
            return res.status(401).json({ 
                success: false, 
                message: 'Not authenticated',
                requestId
            });
        }

        // Convert Mongoose document to plain object and remove sensitive data
        const adminData = req.admin.toObject ? req.admin.toObject() : req.admin;
        delete adminData.password;
        delete adminData.__v;
        
        res.json({
            success: true,
            admin: adminData,
            requestDetails: {
                timestamp: new Date().toISOString(),
                method: req.method,
                endpoint: req.originalUrl
            }
        });
        
    } catch (error) {
        console.error('Error in /me endpoint:', error.message);
        
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? {
                message: error.message,
                stack: error.stack,
                name: error.name
            } : 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});

// ============================================================================
// DEVELOPMENT ROUTES (REMOVE IN PRODUCTION)
// ============================================================================

/**
 * Create Default Admin (Development Only)
 * POST /api/admin/create-admin
 * 
 * Creates a default admin account for development purposes.
 * This route should be removed in production.
 * 
 * @returns {Object} Default admin credentials and token
 */
router.post('/create-admin', async (req, res) => {
    try {
        const { name, email, password } = {
            name: 'Ash Admin',
            email: 'ash@example.com',
            password: 'rajaji1918'
        };

        // Check if admin already exists
        let admin = await Admin.findOne({ email });
        if (admin) {
            return res.status(400).json({
                success: false,
                message: 'Admin already exists'
            });
        }

        // Create new admin
        admin = new Admin({
            name,
            email,
            password,
            role: 'admin'
        });

        // Hash password
        const salt = await bcrypt.genSalt(saltRounds);
        admin.password = await bcrypt.hash(password, salt);

        await admin.save();

        // Create token
        const payload = {
            id: admin._id,
            email: admin.email,
            name: admin.name,
            role: admin.role
        };

        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET || 'your_jwt_secret',
            { expiresIn: '24h' }
        );

        res.status(201).json({
            success: true,
            token,
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role
            }
        });

    } catch (error) {
        console.error('Error creating admin:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating admin',
            error: error.message
        });
    }
});

/**
 * List All Admins (Development Only)
 * GET /api/admin/list-admins
 * 
 * Lists all admin accounts for development purposes.
 * This route should be removed in production.
 * 
 * @returns {Object} List of all admin accounts
 */
router.get('/list-admins', async (req, res) => {
    try {
        const admins = await Admin.find({});
        res.json({
            success: true,
            count: admins.length,
            admins: admins.map(a => ({
                id: a._id,
                email: a.email,
                name: a.name,
                createdAt: a.createdAt
            }))
        });
    } catch (error) {
        console.error('Error listing admins:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching admin users',
            error: error.message
        });
    }
});

module.exports = router;