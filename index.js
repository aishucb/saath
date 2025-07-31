/**
 * Saath Server - Main Application Entry Point
 * 
 * This file serves as the main server application for the Saath platform.
 * It handles user authentication, OTP verification, Google OAuth, WebSocket connections,
 * and serves as the central hub for all API routes.
 * 
 * Features:
 * - User authentication (OTP and Google OAuth)
 * - WebSocket-based real-time chat
 * - Admin management
 * - Event management
 * - Forum and community features
 * 
 * @author Saath Team
 * @version 1.0.0
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const otpGenerator = require('otp-generator');
const session = require('express-session');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');

// Initialize Express application
const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || 'localhost';

// MongoDB connection configuration
const MONGODB_URI = 'mongodb+srv://aiswaryacb755:Y4Q6jzOlsDkGeJe6@datingapp.udz6kxp.mongodb.net/saath?retryWrites=true&w=majority';

// Connect to MongoDB with error handling
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Import database models
const { Customer, Admin, Forum, Message, Event } = require('./models');

// Import route modules
const adminRoutes = require('./adminRoutes');
const adminEventsRoutes = require('./adminEventsRoutes');
const eventsUsersRoutes = require('./eventsUsersRoutes');

/**
 * OTP Schema for phone verification
 * OTPs expire automatically after 5 minutes
 */
const otpSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: '5m' } // Auto-expire after 5 minutes
});

const OTP = mongoose.models.OTP || mongoose.model('OTP', otpSchema);

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

// Body parsing middleware with increased limits for file uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS configuration for cross-origin requests
app.use(cors({
  origin: ['http://localhost:5173', 'https://yourdomain.com', 'http://yourdomain.com', 'https://admin.yourdomain.com'], // Replace 'yourdomain.com' with your actual domain
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
}));

// Serve static files (uploaded images)
app.use('/uploads', express.static('uploads'));

// Import additional route modules
const forumRoutes = require('./forumRoutes');
const forumcommentRoutes = require('./forumcomment');
const auth = require('./middleware/auth');
const followersRouter = require('./followersRoutes');
const chatRoutes = require('./chatRoutes');
const publicEventsRoutes = require('./publicEventsRoutes');
const eventRegistrationRoutes = require('./eventRegistrationRoutes');

// ============================================================================
// ROUTE MOUNTING
// ============================================================================

// Mount all route modules
app.use('/api/forum', forumRoutes);
app.use('/api/forumcomment', forumcommentRoutes);
app.use('/followers', followersRouter);
app.use('/api/chat', chatRoutes);
app.use('/api/admin-events', adminEventsRoutes);
app.use('/api/events-users', eventsUsersRoutes);
app.use('/api/events', publicEventsRoutes);
app.use('/api/event-registrations', eventRegistrationRoutes);

// ============================================================================
// SESSION AND PASSPORT CONFIGURATION
// ============================================================================

// Session middleware configuration for Passport
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: false
}));

// Initialize Passport for authentication
app.use(passport.initialize());
app.use(passport.session());

// Passport serialization for session management
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// ============================================================================
// GOOGLE OAUTH CONFIGURATION (COMMENTED OUT - FOR FUTURE USE)
// ============================================================================

// Google OAuth routes (currently disabled)
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login-failed' }),
  (req, res) => {
    res.redirect('/login-success');
  }
);

app.get('/login-success', (req, res) => {
  res.json({ success: true, user: req.user });
});

// ============================================================================
// ADMIN AUTHENTICATION ROUTES
// ============================================================================

/**
 * Admin Registration Endpoint
 * POST /api/admin/register
 * 
 * Creates a new admin account. This endpoint should be protected in production.
 * 
 * @param {string} email - Admin email address
 * @param {string} password - Admin password
 * @param {string} name - Admin display name
 * @returns {Object} JWT token for authentication
 */
app.post('/api/admin/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // Check if admin already exists
    let admin = await Admin.findOne({ email });
    if (admin) {
      return res.status(400).json({ message: 'Admin already exists' });
    }

    // Create new admin account
    admin = new Admin({
      email,
      password,
      name
    });

    await admin.save();
    
    // Generate JWT token for the new admin
    const payload = {
      admin: {
        id: admin.id
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '5h' },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (err) {
    console.error('Admin registration error:', err.message);
    res.status(500).send('Server error');
  }
});

// Mount admin routes
app.use('/api/admin', adminRoutes);

/**
 * Get Current Admin Profile
 * GET /api/admin/me
 * 
 * Retrieves the current admin's profile information.
 * Requires authentication via x-auth-token header.
 */
app.get('/api/admin/me', auth, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select('-password');
    res.json(admin);
  } catch (err) {
    console.error('Error fetching admin profile:', err.message);
    res.status(500).send('Server error');
  }
});

app.get('/login-failed', (req, res) => {
  res.status(401).json({ success: false, message: 'Google login failed' });
});

// ============================================================================
// GOOGLE SIGN-IN AUTHENTICATION
// ============================================================================

// Initialize Google OAuth client for token verification
const googleClient = new OAuth2Client(process.env.GOOGLE_SERVER_CLIENT_ID);

/**
 * Google Sign-In Endpoint
 * POST /auth/google-signin
 * 
 * Authenticates users using Google OAuth tokens.
 * Creates or updates customer accounts based on Google profile information.
 * 
 * @param {string} idToken - Google ID token for verification
 * @returns {Object} User information and JWT token
 */
app.post('/auth/google-signin', async (req, res) => {
  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ error: 'idToken required' });
    }

    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_SERVER_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    
    // Find or create customer account
    let customer = await Customer.findOne({ email: payload.email });
    let registrationStatus = 'already_registered';
    
    if (!customer) {
      // Create new customer account
      customer = await Customer.create({
        name: payload.name,
        email: payload.email,
        picture: payload.picture,
        googleId: payload.sub,
        createdAt: new Date()
      });
      registrationStatus = 'newly_registered';
    } else {
      // Update existing customer information
      customer.name = payload.name;
      customer.picture = payload.picture;
      customer.googleId = payload.sub;
      await customer.save();
    }

    // Generate JWT token for the customer
    const tokenPayload = {
      _id: customer._id,
      email: customer.email,
      name: customer.name,
      role: 'customer'
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '7d' }
    );

    res.json({ 
      success: true, 
      user: customer, 
      registrationStatus,
      token: token
    });
  } catch (err) {
    console.error('Google sign-in error:', err);
    if (err && err.message) {
      res.status(401).json({ error: 'Invalid Google token', details: err.message });
    } else {
      res.status(401).json({ error: 'Invalid Google token' });
    }
  }
});

// ============================================================================
// CORS AND LOGGING MIDDLEWARE
// ============================================================================

// Additional CORS middleware for broader compatibility
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-auth-token, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// ============================================================================
// OTP AUTHENTICATION ROUTES
// ============================================================================

/**
 * Generate and Send OTP
 * POST /api/otp
 * 
 * Generates a 6-digit OTP and sends it to the provided phone number.
 * In development mode, the OTP is included in the response for testing.
 * 
 * @param {string} phone - Phone number to send OTP to
 * @returns {Object} Success message and OTP (in development)
 */
app.post('/api/otp', async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save or update OTP in database with 5-minute expiration
    await OTP.findOneAndUpdate(
      { phone },
      { otp, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
      { upsert: true, new: true }
    );

    // In development, include OTP in response for testing
    // In production, remove this and send OTP via SMS only
    console.log(`📱 OTP generated for ${phone}: ${otp}`);
    
    res.status(200).json({ 
      message: 'OTP sent successfully',
      otp: otp // Remove this in production
    });
    
  } catch (error) {
    console.error('Error generating OTP:', error);
    res.status(500).json({ error: 'Failed to generate OTP' });
  }
});

/**
 * Verify OTP
 * POST /api/verify-otp
 * 
 * Verifies the provided OTP against the stored OTP for the given phone number.
 * Creates or retrieves customer account upon successful verification.
 * 
 * @param {string} phone - Phone number
 * @param {string} otp - OTP to verify
 * @returns {Object} Verification result and customer information
 */
app.post('/api/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    
    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone number and OTP are required' });
    }

    // Find and verify OTP
    const otpDoc = await OTP.findOne({ phone, otp });
    
    if (otpDoc && otpDoc.otp === otp) {
      // Remove OTP after successful verification
      await OTP.deleteOne({ _id: otpDoc._id });
      
      // Check or add customer account
      let customerResult = null;
      try {
        customerResult = await checkOrAddCustomer(phone);
      } catch (e) {
        customerResult = { error: 'Customer DB error: ' + e.message };
      }
      
      const registrationStatus = customerResult.justAdded ? 'newly_registered' : 'already_registered';
      
      // Generate JWT token for the customer
      const tokenPayload = {
        _id: customerResult.customer._id,
        phone: customerResult.customer.phone,
        role: 'customer'
      };

      const token = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET || 'your_jwt_secret',
        { expiresIn: '7d' }
      );

      res.json({
        success: true,
        message: 'OTP verified successfully',
        registrationStatus,
        customer: customerResult.customer,
        token: token
      });
    } else {
      res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// ============================================================================
// BASIC ROUTES
// ============================================================================

/**
 * Root Endpoint
 * GET /
 * 
 * Returns a welcome message for the Saath API.
 */
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Saath API' });
});

/**
 * Token Verification Test Endpoint
 * POST /api/test-token
 * 
 * Tests JWT token verification for debugging purposes.
 * 
 * @param {string} token - JWT token to verify
 * @returns {Object} Token verification result
 */
app.post('/api/test-token', (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    
    res.json({ 
      success: true, 
      decoded,
      message: 'Token is valid'
    });
  } catch (error) {
    console.error('Token verification failed:', error.message);
    res.status(401).json({ 
      success: false, 
      error: error.message,
      message: 'Token is invalid'
    });
  }
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check or Add Customer by Phone Number
 * 
 * Utility function to find an existing customer by phone number or create a new one.
 * Handles phone number normalization (adds country code if missing).
 * 
 * @param {string} phone - Phone number to check/add
 * @returns {Object} Customer information and registration status
 */
async function checkOrAddCustomer(phone) {
  // Normalize phone number: remove non-digits and add country code if needed
  const cleanPhone = phone.replace(/\D/g, '');
  const phoneWithCountryCode = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

  let customer = await Customer.findOne({ phone: phoneWithCountryCode });
  if (!customer) {
    // Create new customer with just the phone number
    customer = await Customer.create({ phone: phoneWithCountryCode });
    return { exists: true, justAdded: true, customer };
  } else {
    return { exists: true, justAdded: false, customer };
  }
}

// ============================================================================
// CUSTOMER MANAGEMENT ROUTES
// ============================================================================

/**
 * Add or Update Customer Details
 * POST /api/customer
 * 
 * Creates a new customer or updates existing customer information.
 * 
 * @param {string} username - Customer display name
 * @param {string} phone - Phone number
 * @param {string} email - Email address
 * @returns {Object} Operation result and customer ID
 */
app.post('/api/customer', async (req, res) => {
  try {
    const { username, phone, email } = req.body;
    if (!username || !phone || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Normalize phone number
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }

    // Try to find customer by email first
    let customer = await Customer.findOne({ email });
    if (customer) {
      customer.name = username;
      customer.phone = phone;
      customer.email = email;
      await customer.save();
      return res.json({ message: 'Customer updated by email', id: customer._id });
    }

    // Try to find customer by phone
    customer = await Customer.findOne({ phone: cleanPhone });
    if (customer) {
      customer.name = username;
      customer.phone = cleanPhone;
      customer.email = email;
      await customer.save();
      return res.json({ message: 'Customer updated by phone', id: customer._id });
    }

    // Create new customer
    customer = await Customer.create({ name: username, phone: cleanPhone, email });
    return res.json({ message: 'Customer added successfully', id: customer._id });
  } catch (err) {
    console.error('Error in /api/customer:', err);
    res.status(500).json({ error: 'Failed to add/update customer', details: err.message });
  }
});

/**
 * Check Customer Existence by Phone Number
 * GET /api/customer/check
 * 
 * Checks if a customer exists for the given phone number.
 * Creates a new customer if one doesn't exist.
 * 
 * @param {string} phone - Phone number to check
 * @returns {Object} Customer existence status and information
 */
app.get('/api/customer/check', async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }
    const result = await checkOrAddCustomer(phone);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error checking/adding customer:', error);
    res.status(500).json({ success: false, message: 'Server error while checking/adding customer', error: error.message });
  }
});

// ============================================================================
// WEBSOCKET SERVER SETUP
// ============================================================================

// Create HTTP server and attach Express app
const server = http.createServer(app);

// Initialize WebSocket server
const wss = new WebSocket.Server({ server });

// In-memory stores for chat sessions and user connections
const chatSessions = {}; // { sessionId: { users: [userId1, userId2], sockets: [ws1, ws2] } }
const userSockets = {}; // { userId: ws }

/**
 * Create Chat Session Endpoint
 * POST /api/chat/connect
 * 
 * Creates a new chat session between two users or returns existing session.
 * 
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @returns {Object} Session ID for the chat
 */
app.post('/api/chat/connect', async (req, res) => {
  const { userId1, userId2 } = req.body;
  if (!userId1 || !userId2) {
    return res.status(400).json({ error: 'Both user IDs are required' });
  }
  
  // Check if a session already exists for these users
  let sessionId = Object.keys(chatSessions).find(id => {
    const users = chatSessions[id].users;
    return users.includes(userId1) && users.includes(userId2) && users.length === 2;
  });
  
  if (!sessionId) {
    sessionId = uuidv4();
    chatSessions[sessionId] = { users: [userId1, userId2], sockets: [] };
  }
  
  res.json({ sessionId });
});

// ============================================================================
// WEBSOCKET CONNECTION HANDLING
// ============================================================================

/**
 * WebSocket Connection Handler
 * 
 * Manages real-time chat connections, user registration, and message broadcasting.
 * Supports multiple chat sessions and user notifications.
 */
wss.on('connection', (ws, req) => {
  // Handle incoming WebSocket messages
  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      ws.send(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    // Handle user registration for notifications
    if (data.type === 'register' && data.userId) {
      userSockets[data.userId] = ws;
      ws.userId = data.userId;
      ws.send(JSON.stringify({ type: 'registered', userId: data.userId }));
    } 
    // Handle heartbeat ping
    else if (data.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', timestamp: new Date() }));
    } 
    // Handle chat session joining
    else if (data.type === 'join' && data.userId && data.sessionId) {
      userSockets[data.userId] = ws;
      let session = chatSessions[data.sessionId];
      
      if (!session) {
        // Create new session if it doesn't exist
        const users = [data.userId];
        if (data.otherUserId && data.otherUserId !== data.userId) {
          users.push(data.otherUserId);
        }
        session = { users, sockets: [] };
        chatSessions[data.sessionId] = session;
      } else {
        // Add users to existing session if not already present
        if (!session.users.includes(data.userId)) {
          session.users.push(data.userId);
        }
        if (data.otherUserId && !session.users.includes(data.otherUserId)) {
          session.users.push(data.otherUserId);
        }
      }
      
      // Remove any existing socket for this user in other sessions
      Object.values(chatSessions).forEach(sess => {
        sess.sockets = sess.sockets.filter(s => s !== ws && s.userId !== data.userId);
      });
      
      ws.sessionId = data.sessionId;
      ws.userId = data.userId;
      session.sockets.push(ws);
      
      try {
        ws.send(JSON.stringify({ type: 'joined', sessionId: data.sessionId }));
      } catch (err) {
        console.error('Error sending joined event:', err);
      }
    } 
    // Handle chat messages
    else if (data.type === 'message' && ws.sessionId && ws.userId) {
      const session = chatSessions[ws.sessionId];
      if (session) {
        // Find recipient (the other user in the session)
        const recipientId = session.users.find(u => u !== ws.userId);
        
        // Store message in MongoDB
        const messageDoc = new Message({
          sender: ws.userId,
          recipient: recipientId,
          content: data.content,
          replyTo: data.replyTo || null,
          timestamp: new Date()
        });
        
        messageDoc.save()
          .then(saved => {
            console.log('💬 Message saved to database');
          })
          .catch(err => {
            console.error('Error saving message:', err);
          });
        
        // Send message to all users in the session
        session.sockets.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'message',
              from: ws.userId,
              content: data.content,
              replyTo: data.replyTo || null,
              timestamp: messageDoc.timestamp
            }));
          }
        });
        
        // Send notification to recipient if connected
        if (userSockets[recipientId] && userSockets[recipientId].readyState === WebSocket.OPEN) {
          userSockets[recipientId].send(JSON.stringify({
            type: 'notification',
            from: ws.userId,
            content: data.content,
            replyTo: data.replyTo || null,
            timestamp: messageDoc.timestamp
          }));
        }
      }
    }
  });

  // Handle WebSocket connection closure
  ws.on('close', () => {
    // Remove socket from all sessions and user connections
    Object.values(chatSessions).forEach(session => {
      session.sockets = session.sockets.filter(s => s !== ws);
    });
    if (ws.userId && userSockets[ws.userId] === ws) {
      delete userSockets[ws.userId];
    }
  });
});

/**
 * Safe WebSocket Send Helper
 * 
 * Wraps WebSocket send operations with error handling.
 * 
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} messageObj - Message object to send
 */
function safeSend(ws, messageObj) {
  try {
    const msg = JSON.stringify(messageObj);
    ws.send(msg);
  } catch (err) {
    console.error('Error sending WebSocket message:', err);
  }
}

// ============================================================================
// SERVER STARTUP
// ============================================================================

/**
 * Start the server with WebSocket support
 * 
 * Initializes the server, sets up heartbeat mechanism, and creates necessary directories.
 */
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
  console.log('📋 Available endpoints:');
  console.log(`   GET  /`);
  console.log(`   POST /api/otp`);
  console.log(`   POST /api/verify-otp`);
  console.log(`   GET  /api/customer/check?phone=PHONE_NUMBER`);
  console.log(`   POST /api/chat/connect`);

  // Heartbeat mechanism to detect stale connections
  setInterval(() => {
    const now = Date.now();
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.ping();
      }
    });
  }, 30000); // Check every 30 seconds

  // Create middleware directory if it doesn't exist
  const middlewareDir = path.join(__dirname, 'middleware');
  if (!fs.existsSync(middlewareDir)) {
    fs.mkdirSync(middlewareDir);
  }

  // Create auth middleware file if it doesn't exist
  const authMiddlewarePath = path.join(middlewareDir, 'auth.js');
  if (!fs.existsSync(authMiddlewarePath)) {
    const authMiddlewareContent = `const jwt = require('jsonwebtoken');
  
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
    req.admin = decoded.admin;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};`;

    fs.writeFileSync(authMiddlewarePath, authMiddlewareContent);
  }

  // Install required packages
  console.log('📦 Installing required packages...');
  const { execSync } = require('child_process');
  try {
    execSync('npm install jsonwebtoken bcryptjs', { stdio: 'inherit' });
    console.log('✅ Packages installed successfully');
  } catch (error) {
    console.error('❌ Error installing packages:', error);
  }

  console.log('🔐 Admin API endpoints:');
  console.log(`   POST   /api/admin/register - Register a new admin`);
  console.log(`   POST   /api/admin/login - Login admin`);
  console.log(`   GET    /api/admin/me - Get current admin (requires x-auth-token header)`);
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Server Error Handler
 * 
 * Handles server-level errors and provides appropriate error messages.
 */
server.on('error', (error) => {
  console.error('❌ Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`⚠️  Port ${PORT} is already in use`);
  }
});
