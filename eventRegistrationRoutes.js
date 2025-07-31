/**
 * Event Registration Routes
 * 
 * This module handles all event registration-related API endpoints.
 * Customers can register for events, view their registrations, cancel them,
 * and admins can manage check-ins.
 * 
 * Features:
 * - Customer event registration with pricing tiers
 * - Registration management (view, cancel)
 * - Attendee check-in system
 * - Discount application for group registrations
 * - Slot availability management
 * 
 * @author Saath Team
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Import database models
const { Event, Customer } = require('./models');

// ============================================================================
// CUSTOMER AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Customer Authentication Middleware
 * 
 * Validates JWT tokens for customer authentication.
 * Extracts customer information and attaches it to the request object.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
const customerAuth = async (req, res, next) => {
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
            
            // Extract customer ID from various possible token structures
            const customerId = decoded._id || 
                              (decoded.customer && decoded.customer.id) || 
                              decoded.id || 
                              (decoded.customer && decoded.customer._id) ||
                              decoded.customerId;

            if (!customerId) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Customer not found' 
                });
            }
            
            // Find customer by ID
            const customer = await Customer.findById(customerId);
            if (!customer) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Customer not found' 
                });
            }
            
            // Attach customer to request
            req.customer = customer;
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
        console.error('Unexpected error in customer auth middleware:', err.message);
        
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
// REGISTRATION MODEL
// ============================================================================

/**
 * Registration Schema
 * 
 * Defines the structure for event registrations with comprehensive
 * tracking of pricing, discounts, payment status, and check-in information.
 * 
 * @field eventId - Reference to the event
 * @field customerId - Reference to the customer
 * @field pricingTier - Selected pricing tier details
 * @field attendeeCount - Number of attendees
 * @field appliedDiscount - Applied discount information
 * @field registrationDate - Registration timestamp
 * @field status - Registration status (pending/confirmed/cancelled/refunded)
 * @field paymentStatus - Payment status (pending/paid/failed/refunded)
 * @field specialRequests - Customer special requests
 * @field checkInStatus - Check-in status (not-checked-in/checked-in)
 * @field checkInTime - Check-in timestamp
 */
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

// ============================================================================
// DEBUG ROUTES
// ============================================================================

/**
 * Debug Authentication Endpoint
 * POST /api/event-registrations/debug
 * 
 * Tests customer authentication for debugging purposes.
 * 
 * @returns {Object} Authentication status and customer information
 */
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

// ============================================================================
// REGISTRATION MANAGEMENT ROUTES
// ============================================================================

/**
 * Register for an Event
 * POST /api/event-registrations
 * 
 * Creates a new event registration for the authenticated customer.
 * Handles pricing tier selection, discount application, and slot management.
 * 
 * @param {string} eventId - Event ID to register for
 * @param {string} pricingTierName - Name of the pricing tier
 * @param {number} attendeeCount - Number of attendees (default: 1)
 * @param {string} appliedDiscountName - Name of discount to apply (optional)
 * @param {string} specialRequests - Special requests from customer (optional)
 * @returns {Object} Registration details
 */
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

        // Check if event exists and is available for registration
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
            attendeeCount
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

/**
 * Get Customer's Registrations
 * GET /api/event-registrations/my-registrations
 * 
 * Retrieves all registrations for the authenticated customer with pagination.
 * 
 * Query Parameters:
 * @param {string} status - Filter by registration status (optional)
 * @param {number} page - Page number for pagination (default: 1)
 * @param {number} limit - Items per page (default: 10)
 * 
 * @returns {Object} Paginated list of customer registrations
 */
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

/**
 * Get Single Registration
 * GET /api/event-registrations/:id
 * 
 * Retrieves details of a specific registration for the authenticated customer.
 * 
 * @param {string} id - Registration ID
 * @returns {Object} Registration details with event information
 */
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

/**
 * Cancel Registration
 * PATCH /api/event-registrations/:id/cancel
 * 
 * Cancels a customer's registration and updates event slot availability.
 * Cannot cancel paid registrations (requires refund process).
 * 
 * @param {string} id - Registration ID
 * @returns {Object} Cancellation confirmation
 */
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

// ============================================================================
// ADMIN ROUTES
// ============================================================================

/**
 * Check-in Attendee (Admin Only)
 * PATCH /api/event-registrations/:id/check-in
 * 
 * Marks an attendee as checked in for an event.
 * This route should be protected with admin authentication in production.
 * 
 * @param {string} id - Registration ID
 * @returns {Object} Check-in confirmation
 */
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