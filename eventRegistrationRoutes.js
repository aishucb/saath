const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Import models
const { Event, Customer } = require('./models');

// Authentication middleware for customers
const customerAuth = async (req, res, next) => {
    const requestId = Math.random().toString(36).substring(2, 8);
    console.log(`[${requestId}] Customer auth check for: ${req.method} ${req.path}`);
    
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
            // Verify JWT token
            console.log(`🔍 [${requestId}] Verifying customer token...`);
            console.log(`🔍 [${requestId}] JWT_SECRET: ${process.env.JWT_SECRET ? 'Set' : 'Using default'}`);
            console.log(`🔍 [${requestId}] Token preview: ${token.substring(0, 50)}...`);
            
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
            
            console.log(`✅ [${requestId}] Token verified`);
            console.log(`🔍 [${requestId}] Decoded token payload:`, decoded);
            
            // Get customer ID from various possible locations in the token
            const customerId = decoded._id || 
                              (decoded.customer && decoded.customer.id) || 
                              decoded.id || 
                              (decoded.customer && decoded.customer._id) ||
                              decoded.customerId;

            console.log(`🔍 [${requestId}] Extracted customer ID:`, customerId);

            if (!customerId) {
                const error = new Error('No customer ID found in token');
                console.error(`❌ [${requestId}] ${error.message}`);
                return res.status(401).json({ 
                    success: false, 
                    message: 'Customer not found' 
                });
            }
            
            // Find customer by ID
            const customer = await Customer.findById(customerId);
            if (!customer) {
                console.log(`[${requestId}] Customer not found for ID:`, customerId);
                return res.status(401).json({ 
                    success: false, 
                    message: 'Customer not found' 
                });
            }
            
            // Attach customer to request
            req.customer = customer;
            req.requestId = requestId;
            
            console.log(`[${requestId}] Authenticated as customer:`, customer.email || customer.phone);
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
        console.error(`❌ [${requestId || 'unknown'}] Unexpected error in customer auth middleware:`, {
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

// Registration Schema
const registrationSchema = new mongoose.Schema({
    eventId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Event', 
        required: true 
    },
    customerId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Customer', 
        required: true 
    },
    pricingTier: {
        name: { type: String, required: true },
        price: { type: Number, required: true },
        description: { type: String }
    },
    attendeeCount: { 
        type: Number, 
        required: true, 
        default: 1,
        min: 1 
    },
    appliedDiscount: {
        name: { type: String },
        percentageDiscount: { type: Number },
        originalPrice: { type: Number },
        finalPrice: { type: Number }
    },
    registrationDate: { 
        type: Date, 
        default: Date.now 
    },
    status: { 
        type: String, 
        enum: ['pending', 'confirmed', 'cancelled', 'refunded'],
        default: 'pending'
    },
    paymentStatus: { 
        type: String, 
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending'
    },
    specialRequests: { 
        type: String 
    },
    checkInStatus: { 
        type: String, 
        enum: ['not-checked-in', 'checked-in'],
        default: 'not-checked-in'
    },
    checkInTime: { 
        type: Date 
    }
});

// Create Registration model
const Registration = mongoose.models.Registration || mongoose.model('Registration', registrationSchema);

// Debug endpoint to test authentication
router.post('/debug', customerAuth, async (req, res) => {
  res.json({ 
    success: true, 
    message: 'Authentication successful',
    customer: {
      id: req.customer._id,
      email: req.customer.email,
      phone: req.customer.phone
    }
  });
});

// @route   POST /api/event-registrations
// @desc    Register for an event
// @access  Private (Customer)
router.post('/', customerAuth, async (req, res) => {
    try {
        const {
            eventId,
            pricingTierName,
            attendeeCount = 1, // Default to 1 if not provided
            appliedDiscountName,
            specialRequests
        } = req.body;

        // Validate required fields
        if (!eventId || !pricingTierName) {
            return res.status(400).json({
                success: false,
                message: 'Event ID and pricing tier are required'
            });
        }

        // Check if event exists and is published (or draft for development)
        const event = await Event.findOne({ 
            _id: eventId, 
            status: { $in: ['published', 'draft'] } // Allow draft events for development
        });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found or not available for registration'
            });
        }

        // Check if event date is in the future
        if (new Date(event.date) <= new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot register for past events'
            });
        }

        // Find the pricing tier
        const pricingTier = event.pricing.find(tier => tier.name === pricingTierName);
        if (!pricingTier) {
            return res.status(400).json({
                success: false,
                message: 'Invalid pricing tier'
            });
        }

        // Check if slots are available for the requested number of attendees
        if (pricingTier.slotsAvailable < attendeeCount) {
            return res.status(400).json({
                success: false,
                message: `Only ${pricingTier.slotsAvailable} slots available, but ${attendeeCount} requested`
            });
        }

        // Check if customer is already registered
        const existingRegistration = await Registration.findOne({
            eventId,
            customerId: req.customer._id,
            status: { $in: ['pending', 'confirmed'] }
        });

        if (existingRegistration) {
            return res.status(400).json({
                success: false,
                message: 'You are already registered for this event'
            });
        }

        // Calculate pricing with discount for multiple attendees
        let finalPrice = pricingTier.price * attendeeCount;
        let appliedDiscount = null;

        if (appliedDiscountName) {
            const discountOption = event.discountOptions.find(discount => discount.name === appliedDiscountName);
            if (discountOption) {
                appliedDiscount = {
                    name: discountOption.name,
                    percentageDiscount: discountOption.percentageDiscount,
                    originalPrice: pricingTier.price * attendeeCount,
                    finalPrice: (pricingTier.price * attendeeCount) * (1 - discountOption.percentageDiscount / 100)
                };
                finalPrice = appliedDiscount.finalPrice;
            }
        }

        // Create registration
        const registration = new Registration({
            eventId,
            customerId: req.customer._id,
            pricingTier: {
                name: pricingTier.name,
                price: pricingTier.price,
                description: pricingTier.description
            },
            appliedDiscount,
            specialRequests,
            finalPrice,
            attendeeCount // Add attendee count to registration
        });

        await registration.save();

        // Update event slots
        pricingTier.slotsAvailable -= attendeeCount;
        await event.save();

        // Populate event details
        await registration.populate('eventId', 'eventName date place organizer');

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: registration
        });
    } catch (error) {
        console.error('Error creating registration:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create registration',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// @route   GET /api/event-registrations/my-registrations
// @desc    Get customer's registrations
// @access  Private (Customer)
router.get('/my-registrations', customerAuth, async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;

        const filter = { customerId: req.customer._id };
        if (status) filter.status = status;

        const registrations = await Registration.find(filter)
            .populate('eventId', 'eventName date place organizer eventTime')
            .sort({ registrationDate: -1 })
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit));

        const total = await Registration.countDocuments(filter);

        res.json({
            success: true,
            data: registrations,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching registrations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch registrations',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// @route   GET /api/event-registrations/:id
// @desc    Get single registration
// @access  Private (Customer)
router.get('/:id', customerAuth, async (req, res) => {
    try {
        const registration = await Registration.findOne({
            _id: req.params.id,
            customerId: req.customer._id
        }).populate('eventId', 'eventName date place organizer eventTime description');

        if (!registration) {
            return res.status(404).json({
                success: false,
                message: 'Registration not found'
            });
        }

        res.json({
            success: true,
            data: registration
        });
    } catch (error) {
        console.error('Error fetching registration:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch registration',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// @route   PATCH /api/event-registrations/:id/cancel
// @desc    Cancel registration
// @access  Private (Customer)
router.patch('/:id/cancel', customerAuth, async (req, res) => {
    try {
        const registration = await Registration.findOne({
            _id: req.params.id,
            customerId: req.customer._id
        });

        if (!registration) {
            return res.status(404).json({
                success: false,
                message: 'Registration not found'
            });
        }

        if (registration.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Registration is already cancelled'
            });
        }

        if (registration.status === 'confirmed' && registration.paymentStatus === 'paid') {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel paid registration. Please contact support for refund.'
            });
        }

        registration.status = 'cancelled';
        await registration.save();

        // Update event slots
        const event = await Event.findById(registration.eventId);
        if (event) {
            const pricingTier = event.pricing.find(tier => tier.name === registration.pricingTier.name);
            if (pricingTier) {
                pricingTier.slotsAvailable += 1;
                await event.save();
            }
        }

        res.json({
            success: true,
            message: 'Registration cancelled successfully',
            data: registration
        });
    } catch (error) {
        console.error('Error cancelling registration:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel registration',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// @route   PATCH /api/event-registrations/:id/check-in
// @desc    Check in attendee (Admin only)
// @access  Private (Admin)
router.patch('/:id/check-in', async (req, res) => {
    try {
        const registration = await Registration.findById(req.params.id)
            .populate('eventId', 'eventName date');

        if (!registration) {
            return res.status(404).json({
                success: false,
                message: 'Registration not found'
            });
        }

        if (registration.checkInStatus === 'checked-in') {
            return res.status(400).json({
                success: false,
                message: 'Attendee is already checked in'
            });
        }

        registration.checkInStatus = 'checked-in';
        registration.checkInTime = new Date();
        await registration.save();

        res.json({
            success: true,
            message: 'Check-in successful',
            data: registration
        });
    } catch (error) {
        console.error('Error checking in:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check in',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router; 