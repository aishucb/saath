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
const { Customer, Admin, Forum } = require('./models');
const adminRoutes = require('./adminRoutes');

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

// Import routes
const forumRoutes = require('./forumRoutes');
const forumcommentRoutes = require('./forumcomment');
const auth = require('./middleware/auth');
const followersRouter = require('./followersRoutes');

// Use forum routes
app.use('/api/forum', forumRoutes);
app.use('/api/forumcomment', forumcommentRoutes);
app.use('/followers', followersRouter);

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
    res.json({ success: true, user: customer, registrationStatus });
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
      res.json({
        success: true,
        message: 'OTP verified successfully',
        registrationStatus,
        customer: customerResult.customer
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

// Start server
const server = app.listen(5000, () => {
  const address = server.address();
  if (address) {
    console.log(`Server is running on http://localhost:${address.port}`);
    console.log('Available endpoints:');
    console.log(`- GET  /`);
    console.log(`- POST /api/otp`);
    console.log(`- POST /api/verify-otp`);
    console.log(`- GET  /api/customer/check?phone=PHONE_NUMBER`);

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
  } else {
    console.log('Server started, but address info is not available.');
  }
});

// Handle server errors
server.on('error', (error) => {
  console.error('Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${5000} is already in use`);
    console.error(`Port ${PORT} is already in use`);
  }
});
