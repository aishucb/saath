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

const app = express();
const PORT = process.env.PORT || 5000; // Using port 5000 as per running instance
const HOST = process.env.HOST || 'localhost';

// MongoDB connection
const MONGODB_URI = 'mongodb+srv://aiswaryacb755:Y4Q6jzOlsDkGeJe6@datingapp.udz6kxp.mongodb.net/saath?retryWrites=true&w=majority';

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Import models
const { Customer, Admin, Forum, Message, Event } = require('./models');
const adminRoutes = require('./adminRoutes');
const adminEventsRoutes = require('./adminEventsRoutes');
const eventsUsersRoutes = require('./eventsUsersRoutes');

// OTP Schema
const otpSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: '5m' } // OTP expires in 5 minutes
});

const OTP = mongoose.models.OTP || mongoose.model('OTP', otpSchema);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enable CORS
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
}));

// Serve static files (uploaded images)
app.use('/uploads', express.static('uploads'));

// Import routes
const forumRoutes = require('./forumRoutes');
const forumcommentRoutes = require('./forumcomment');
const auth = require('./middleware/auth');
const followersRouter = require('./followersRoutes');
const chatRoutes = require('./chatRoutes');
const publicEventsRoutes = require('./publicEventsRoutes');
const eventRegistrationRoutes = require('./eventRegistrationRoutes');

// Use forum routes
app.use('/api/forum', forumRoutes);
app.use('/api/forumcomment', forumcommentRoutes);
app.use('/followers', followersRouter);
app.use('/api/chat', chatRoutes);
app.use('/api/admin-events', adminEventsRoutes);

// Mount user events routes
app.use('/api/events-users', eventsUsersRoutes);
app.use('/api/events', publicEventsRoutes);
app.use('/api/event-registrations', eventRegistrationRoutes);

// Session middleware (required for Passport)
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: false
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Passport serialization
passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((user, done) => {
  done(null, user);
});

// Configure Google OAuth Strategy
// passport.use(new GoogleStrategy({
//   clientID: process.env.GOOGLE_CLIENT_ID,
//   clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//   callbackURL: "/auth/google/callback"
// },
// async (accessToken, refreshToken, profile, done) => {
//   // Here you can handle user info (e.g., save to DB)
//   // For now, just pass the profile
//   return done(null, profile);
// }
// ));

// Google OAuth routes
// app.get('/auth/google',
//   passport.authenticate('google', { scope: ['profile', 'email'] })
// );

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login-failed' }),
  (req, res) => {
    // Successful authentication
    res.redirect('/login-success'); // or send a token/response as needed
  }
);

app.get('/login-success', (req, res) => {
  res.json({ success: true, user: req.user });
});

// Admin Registration (for initial setup, should be protected in production)
app.post('/api/admin/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // Check if admin already exists
    let admin = await Admin.findOne({ email });
    if (admin) {
      return res.status(400).json({ message: 'Admin already exists' });
    }

    // Create new admin
    admin = new Admin({
      email,
      password,
      name
    });

    await admin.save();
    
    // Create JWT token
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
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Mount admin routes
app.use('/api/admin', adminRoutes);


// Get current admin
app.get('/api/admin/me', auth, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select('-password');
    res.json(admin);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

app.get('/login-failed', (req, res) => {
  res.status(401).json({ success: false, message: 'Google login failed' });
});

// Google Sign-In direct endpoint
// Use the Web OAuth client ID (serverClientId) for verifying idTokens from mobile
const googleClient = new OAuth2Client(process.env.GOOGLE_SERVER_CLIENT_ID);

app.post('/auth/google-signin', async (req, res) => {
  try {
    const { idToken } = req.body;
    console.log('Received idToken:', idToken ? idToken.substring(0, 40) + '...' : 'undefined');
    console.log('GOOGLE_SERVER_CLIENT_ID:', process.env.GOOGLE_SERVER_CLIENT_ID);
    if (!idToken) return res.status(400).json({ error: 'idToken required' });
    // Verify the token with the Web client ID as audience
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_SERVER_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    console.log('Decoded Google payload:', payload);
    // Save or update user in MongoDB (Customer collection)
    let customer = await Customer.findOne({ email: payload.email });
    let registrationStatus = 'already_registered';
    if (!customer) {
      customer = await Customer.create({
        name: payload.name,
        email: payload.email,
        picture: payload.picture,
        googleId: payload.sub,
        createdAt: new Date()
      });
      registrationStatus = 'newly_registered';
    } else {
      // Optionally update name/picture if changed
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
      token: token // Include the JWT token in response
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

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-auth-token, Authorization');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  
  next();
});

// Generate and send OP
app.post('/api/otp', async (req, res) => {
  console.log('OTP Request Body:', req.body);
  try {
    console.log("Phone number received: ")
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save or update OTP in database
    await OTP.findOneAndUpdate(
      { phone },
      { otp, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
      { upsert: true, new: true }
    );

    // For development, include OTP in response
    // In production, remove this and send OTP via SMS only
    console.log(`OTP for ${phone}: ${otp}`);
    
    res.status(200).json({ 
      message: 'OTP sent successfully',
      otp: otp // Include OTP in response for testing
    });
    
  } catch (error) {
    console.error('Error generating OTP:', error);
    res.status(500).json({ error: 'Failed to generate OTP' });
  }
});

// Verify OTP
app.post('/api/verify-otp', async (req, res) => {
  console.log('Inside /api/verify-otp handler, body:', req.body);
  try {
    const { phone, otp } = req.body;
    
    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone number and OTP are required' });
    }

    const otpDoc = await OTP.findOne({ phone, otp });
    
    if (otpDoc && otpDoc.otp === otp) {
      await OTP.deleteOne({ _id: otpDoc._id }); // Remove OTP after successful verification
      // Check or add customer and include result in response
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
        token: token // Include the JWT token in response
      });
    } else {
      res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Saath API' });
});

// Test token verification endpoint
app.post('/api/test-token', (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }
    
    console.log('Testing token verification...');
    console.log('Token:', token.substring(0, 50) + '...');
    console.log('JWT_SECRET:', process.env.JWT_SECRET || 'your_jwt_secret');
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    console.log('Decoded token:', decoded);
    
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

// Utility function to check if customer exists by phone
async function checkOrAddCustomer(phone) {
  console.log('checkOrAddCustomer called with:', phone);
  // Remove any non-digit characters and add country code if missing
  const cleanPhone = phone.replace(/\D/g, '');
  const phoneWithCountryCode = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  console.log('Processed phone number:', phoneWithCountryCode);

  let customer = await Customer.findOne({ phone: phoneWithCountryCode });
  if (!customer) {
    console.log('Customer not found for:', phoneWithCountryCode);
    // Create new customer with just the phone number
    customer = await Customer.create({ phone: phoneWithCountryCode });
    return { exists: true, justAdded: true, customer };
  } else {
    console.log('Customer already exists for:', phoneWithCountryCode);
    return { exists: true, justAdded: false, customer };
  }
}

// Add or update customer details
app.post('/api/customer', async (req, res) => {
  try {
    const { username, phone, email } = req.body;
    if (!username || !phone || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Normalize phone: remove non-digits, prepend 91 if 10 digits
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }

    // 1. Try to find by email
    let customer = await Customer.findOne({ email });
    if (customer) {
      customer.name = username;
      customer.phone = phone;
      customer.email = email;
      await customer.save();
      return res.json({ message: 'Customer updated by email', id: customer._id });
    }

    // 2. Try to find by phone
    customer = await Customer.findOne({ phone: cleanPhone });
    if (customer) {
      customer.name = username;
      customer.phone = cleanPhone;
      customer.email = email;
      await customer.save();
      return res.json({ message: 'Customer updated by phone', id: customer._id });
    }

    // 3. Create new customer
    customer = await Customer.create({ name: username, phone: cleanPhone, email });
    return res.json({ message: 'Customer added successfully', id: customer._id });
  } catch (err) {
    console.error('Error in /api/customer:', err);
    res.status(500).json({ error: 'Failed to add/update customer', details: err.message });
  }
});

// Check if customer exists by phone number (uses the utility function)
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

// Use routes
app.use('/api/forum', forumRoutes);
app.use('/api/admin', adminRoutes);

// Enhanced logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Create HTTP server and attach Express app
const server = http.createServer(app);

// WebSocket server setup
const wss = new WebSocket.Server({ server });

// In-memory store for chat sessions and user connections
const chatSessions = {}; // { sessionId: { users: [userId1, userId2], sockets: [ws1, ws2] } }
const userSockets = {}; // { userId: ws }

// API endpoint to create a chat session between two users
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

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  // Expect client to send a JSON message: { type: 'join', userId, sessionId }
  ws.on('message', (message) => {
    console.log('Received WebSocket message:', message); // Debug print
    let data;
    try {
      data = JSON.parse(message);
      console.log('Parsed data:', data); // Debug print
    } catch (e) {
      ws.send(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }
    // Debug logs for session and user
    // Handle user registration for notifications
    if (data.type === 'register' && data.userId) {
      userSockets[data.userId] = ws;
      ws.userId = data.userId;
      ws.send(JSON.stringify({ type: 'registered', userId: data.userId }));
    } else if (data.type === 'ping') {
      // Handle heartbeat ping
      ws.send(JSON.stringify({ type: 'pong', timestamp: new Date() }));
    } else if (data.type === 'join' && data.userId && data.sessionId) {
      userSockets[data.userId] = ws;
      let session = chatSessions[data.sessionId];
      if (!session) {
        // If session does not exist, create it for this user and the other user if provided
        const users = [data.userId];
        if (data.otherUserId && data.otherUserId !== data.userId) {
          users.push(data.otherUserId);
        }
        session = { users, sockets: [] };
        chatSessions[data.sessionId] = session;
        console.log('SERVER: Created new session in memory for sessionId', data.sessionId, 'with users', users);
      } else {
        // Always add the joining user if not already present
        if (!session.users.includes(data.userId)) {
          session.users.push(data.userId);
        }
        // Also add otherUserId if provided and not present
        if (data.otherUserId && !session.users.includes(data.otherUserId)) {
          session.users.push(data.otherUserId);
        }
      }
      // Remove any existing socket for this user in ANY session
      Object.values(chatSessions).forEach(sess => {
        sess.sockets = sess.sockets.filter(s => s !== ws && s.userId !== data.userId);
      });
      ws.sessionId = data.sessionId;
      ws.userId = data.userId;
      session.sockets.push(ws);
      try {
        console.log('SERVER: About to send to client:', JSON.stringify({ type: 'joined', sessionId: data.sessionId }));
        ws.send(JSON.stringify({ type: 'joined', sessionId: data.sessionId }));
        console.log('SERVER: Sent to client:', JSON.stringify({ type: 'joined', sessionId: data.sessionId }));
      } catch (err) {
        console.error('SERVER: Error sending joined event:', err);
      }
      // Debug print after assignment
      console.log('AFTER JOIN: ws.sessionId:', ws.sessionId, 'ws.userId:', ws.userId);
      console.log('chatSessions:', chatSessions);
    } else if (data.type === 'message' && ws.sessionId && ws.userId) {
      // Broadcast message to the other user in the session
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
            console.log('Message saved to DB:', saved);
          })
          .catch(err => {
            console.error('Error saving message:', err);
          });
        // Send message to ALL users in the session (including sender)
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
        // Send notification to recipient if they are connected (even if not in this session)
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
  ws.on('close', () => {
    // Remove socket from ALL sessions and userSockets
    Object.values(chatSessions).forEach(session => {
      session.sockets = session.sockets.filter(s => s !== ws);
    });
    if (ws.userId && userSockets[ws.userId] === ws) {
      delete userSockets[ws.userId];
    }
  });
});

// Add a helper to wrap all ws.send calls
function safeSend(ws, messageObj) {
  try {
    const msg = JSON.stringify(messageObj);
    console.log('SERVER: About to send to client:', msg);
    ws.send(msg);
    console.log('SERVER: Sent to client:', msg);
  } catch (err) {
    console.error('SERVER: Error sending message:', err);
  }
}

// Start the server with WebSocket support
server.listen(PORT, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log('Available endpoints:');
  console.log(`- GET  /`);
  console.log(`- POST /api/otp`);
  console.log(`- POST /api/verify-otp`);
  console.log(`- GET  /api/customer/check?phone=PHONE_NUMBER`);
  console.log(`- POST /api/chat/connect - Create a chat session`);

  // Heartbeat mechanism to detect stale connections
  setInterval(() => {
    const now = Date.now();
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        // Send a ping to check if connection is still alive
        client.ping();
      }
    });
  }, 30000); // Check every 30 seconds

  // Create middleware directory if it doesn't exist
  const fs = require('fs');
  const path = require('path');

  const middlewareDir = path.join(__dirname, 'middleware');
  if (!fs.existsSync(middlewareDir)) {
    fs.mkdirSync(middlewareDir);
  }

  // Create auth middleware file
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
  console.log('Installing required packages...');
  const { execSync } = require('child_process');
  try {
    execSync('npm install jsonwebtoken bcryptjs', { stdio: 'inherit' });
    console.log('Packages installed successfully');
  } catch (error) {
    console.error('Error installing packages:', error);
  }

  console.log('Admin API endpoints:');
  console.log(`POST   /api/admin/register - Register a new admin`);
  console.log(`POST   /api/admin/login - Login admin`);
  console.log(`GET    /api/admin/me - Get current admin (requires x-auth-token header)`);
});

// Handle server errors
server.on('error', (error) => {
  console.error('Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${5000} is already in use`);
    console.error(`Port ${PORT} is already in use`);
  }
});
