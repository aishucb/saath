const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Authentication middleware
const auth = async (req, res, next) => {
    const requestId = Math.random().toString(36).substring(2, 8);
    console.log(`[${requestId}] Auth check for: ${req.method} ${req.path}`);
    
    try {
        // Get token from header
        const authHeader = req.header('Authorization');
        
        if (!authHeader) {
            console.log(`[${requestId}] No authorization header`);
            return res.status(401).json({ 
                success: false, 
                message: 'No token provided'
            });
        }

        if (!authHeader.startsWith('Bearer ')) {
            console.log(`[${requestId}] Invalid token format`);
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid token format'
            });
        }

        const token = authHeader.replace('Bearer ', '').trim();
        
        try {
            // Verify token
            console.log(`🔍 [${requestId}] Verifying token...`);
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
            
            console.log(`✅ [${requestId}] Token verified`);
            console.log(`📝 [${requestId}] Token payload:`, JSON.stringify({
                id: decoded._id || decoded.id,
                email: decoded.email,
                iat: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : null,
                exp: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null
            }, null, 2));
            
            // Get admin ID from various possible locations in the token
            const adminId = decoded._id || 
                           (decoded.admin && decoded.admin.id) || 
                           decoded.id || 
                           (decoded.admin && decoded.admin._id);

            console.log(`🔍 [${requestId}] Extracted admin ID:`, adminId);
            console.log(`🔍 [${requestId}] Full decoded token:`, JSON.stringify(decoded, null, 2));

            if (!adminId) {
                const error = new Error('No admin ID found in token');
                console.error(`❌ [${requestId}] ${error.message}`, { 
                    decodedKeys: Object.keys(decoded),
                    hasAdmin: !!decoded.admin,
                    decodedAdmin: decoded.admin ? Object.keys(decoded.admin) : 'no admin object'
                });
                return res.status(401).json({ 
                    success: false, 
                    message: 'Admin not found' 
                });
            }
            
            // Find admin by ID
            const admin = await Admin.findById(adminId).select('-password');
            if (!admin) {
                console.log(`[${requestId}] Admin not found for ID:`, adminId);
                return res.status(401).json({ 
                    success: false, 
                    message: 'Admin not found' 
                });
            }
            
            // Attach admin to request
            req.admin = admin;
            req.requestId = requestId;
            
            console.log(`[${requestId}] Authenticated as:`, admin.email);
            next();
        } catch (error) {
            console.error(`[${requestId}] Auth failed:`, error.message);
            
            const errorMessage = error.name === 'TokenExpiredError' 
                ? 'Token has expired' 
                : 'Invalid token';
            
            return res.status(401).json({ 
                success: false, 
                message: errorMessage
            });
        }
    } catch (err) {
        console.error(`❌ [${requestId || 'unknown'}] Unexpected error in auth middleware:`, {
            message: err.message,
            name: err.name,
            stack: err.stack
        });
        
        res.status(500).json({
            success: false,
            message: 'Authentication failed',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined,
            requestId: requestId || 'unknown',
            timestamp: new Date().toISOString()
        });
    }
};

// Constants
const saltRounds = 10;

// Admin Schema
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

// Hash password before saving
adminSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    next();
});

// Create Admin model if it doesn't exist
const Admin = mongoose.models.Admin || mongoose.model('Admin', adminSchema, 'Admins');

// Simple hello endpoint
router.get('/hello', (req, res) => {
    res.json({ message: 'Hello from admin routes!' });
});

// @route   POST /api/admin/register
// @desc    Register a new admin
// @access  Public (should be protected in production)
router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        // Validation
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

// @route   POST /api/admin/login
// @desc    Authenticate admin & get token
// @access  Public
router.post('/login', async (req, res) => {
    const requestId = Math.random().toString(36).substring(2, 8);
    
    try {
        console.log(`\n🔵 [${requestId}] ===== LOGIN REQUEST =====`);
        console.log(`[${requestId}] Request body:`, JSON.stringify(req.body, null, 2));

        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            console.log(`[${requestId}] ❌ Validation failed - missing email or password`);
            return res.status(400).json({ 
                success: false, 
                message: 'Please provide both email and password',
                requestId
            });
        }

        // Check if admin exists
        console.log(`[${requestId}] 🔍 Looking for admin with email:`, email);
        let admin;
        try {
            admin = await Admin.findOne({ email }).select('+password').lean();
            console.log(`[${requestId}] Admin found:`, admin ? 'Yes' : 'No');
        } catch (dbError) {
            console.error(`[${requestId}] ❌ Database error:`, dbError);
            return res.status(500).json({
                success: false,
                message: 'Database error',
                error: dbError.message,
                requestId
            });
        }

        if (!admin) {
            console.log(`[${requestId}] ❌ No admin found with email:`, email);
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid credentials',
                requestId
            });
        }

        // Check password
        console.log(`[${requestId}] 🔑 Checking password...`);
        let isMatch = false;
        try {
            isMatch = await bcrypt.compare(password, admin.password);
            console.log(`[${requestId}] Password match:`, isMatch);
        } catch (bcryptError) {
            console.error(`[${requestId}] ❌ Bcrypt error:`, bcryptError);
            return res.status(500).json({
                success: false,
                message: 'Authentication error',
                error: bcryptError.message,
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

            // Sign token
            const token = jwt.sign(
                payload,
                process.env.JWT_SECRET || 'your_jwt_secret',
                { expiresIn: '24h' }
            );

            // Remove password from response
            const { password: _, ...adminWithoutPassword } = admin;

            console.log(`[${requestId}] ✅ Login successful for admin:`, admin.email);
            
            res.json({
                success: true,
                token: token, // Return token without 'Bearer ' prefix
                admin: adminWithoutPassword,
                requestId
            });
        } catch (tokenError) {
            console.error(`[${requestId}] ❌ Token generation error:`, tokenError);
            return res.status(500).json({
                success: false,
                message: 'Error generating authentication token',
                error: tokenError.message,
                requestId
            });
        }

    } catch (error) {
        console.error('❌ [LOGIN ERROR]', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code,
            requestBody: req.body,
            timestamp: new Date().toISOString()
        });
        
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

// @route   GET /api/admin/me
// @desc    Get current admin
// @access  Private
router.get('/me', auth, async (req, res) => {
    const requestId = req.requestId || Math.random().toString(36).substring(2, 8);
    const requestTime = new Date().toISOString();
    
    console.log(`\n🔵 [${requestId}] ===== /me ENDPOINT HIT =====`);
    console.log(`📡 [${requestId}] ${requestTime} - ${req.method} ${req.originalUrl}`);
    
    try {
        if (!req.admin) {
            console.error(`❌ [${requestId}] No admin found in request object`);
            return res.status(401).json({ 
                success: false, 
                message: 'Not authenticated',
                requestId
            });
        }
        // 1. Log basic request info
        console.log(`\n📋 [${requestId}] === REQUEST DETAILS ===`);
        console.log(`🕒 Timestamp: ${requestTime}`);
        console.log(`🌐 IP: ${req.ip || req.connection.remoteAddress || 'unknown'}`);
        console.log(`🖥️  User Agent: ${req.get('user-agent') || 'none'}`);
        console.log(`📡 Method: ${req.method}`);
        console.log(`🔗 URL: ${req.originalUrl}`);
        
        // 2. Log headers
        console.log(`\n📦 [${requestId}] === HEADERS ===`);
        const headers = {};
        Object.keys(req.headers).forEach(key => {
            if (key.toLowerCase() === 'authorization') {
                const authParts = req.headers[key].split('.');
                headers[key] = `Bearer ${authParts[0]}.${'*'.repeat(10)}.${authParts[2] || ''}`;
            } else {
                headers[key] = req.headers[key];
            }
        });
        console.log(JSON.stringify(headers, null, 2));
        
        // 3. Log authentication details
        console.log(`\n🔑 [${requestId}] === AUTHENTICATION ===`);
        const authHeader = req.headers.authorization || req.headers.Authorization || '';
        const token = authHeader.split(' ')[1] || '';
        
        console.log(`🔒 Auth Header: ${authHeader ? 'Present' : 'Missing'}`);
        console.log(`🔑 Token Length: ${token.length} characters`);
        console.log(`👤 Authenticated: ${!!req.admin ? 'Yes' : 'No'}`);
        
        if (req.admin) {
            console.log(`👤 Admin ID: ${req.admin._id || 'none'}`);
            console.log(`📧 Admin Email: ${req.admin.email || 'none'}`);
        }
        
        // 4. Log request body if present
        if (req.body && Object.keys(req.body).length > 0) {
            console.log(`\n📝 [${requestId}] === REQUEST BODY ===`);
            console.log(JSON.stringify(req.body, null, 2));
        }
        
        // 5. Log query parameters if present
        if (req.query && Object.keys(req.query).length > 0) {
            console.log(`\n🔍 [${requestId}] === QUERY PARAMETERS ===`);
            console.log(JSON.stringify(req.query, null, 2));
        }
        
        // 6. Check if admin exists in request (from auth middleware)
        if (!req.admin) {
            console.error(`\n❌ [${requestId}] === AUTHENTICATION FAILED ===`);
            console.error('No admin found in request object');
            console.error('Auth header present:', !!authHeader);
            console.error('Token present:', !!token);
            
            return res.status(401).json({ 
                success: false, 
                message: 'Not authenticated',
                receivedToken: !!authHeader,
                requestId,
                timestamp: requestTime
            });
        }
        
        // 7. Log successful authentication
        console.log(`\n✅ [${requestId}] === AUTHENTICATION SUCCESSFUL ===`);
        console.log(`👤 Admin ID: ${req.admin._id}`);
        console.log(`📧 Email: ${req.admin.email}`);
        console.log(`🔄 Request ID: ${requestId}`);

        // Convert Mongoose document to plain object and remove sensitive data
        const adminData = req.admin.toObject ? req.admin.toObject() : req.admin;
        delete adminData.password;
        delete adminData.__v;
        
        console.log('✅ Sending admin data:', JSON.stringify(adminData, null, 2));
        
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
        console.error('❌ Error in /me endpoint:', {
            message: error.message,
            name: error.name,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            request: {
                method: req.method,
                url: req.originalUrl,
                headers: req.headers,
                body: req.body
            }
        });
        
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

// Temporary route to create an admin (remove in production)
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

// Temporary route to list all admins (remove in production)
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