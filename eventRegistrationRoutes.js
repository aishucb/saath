const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Import models
const { Event, Customer } = require('./models');

// Authentication middleware for customers
const customerAuth = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false, 
                message: 'No token provided'
            });
        }

        const token = authHeader.replace('Bearer ', '').trim();
        
        // For now, we'll use a simple customer ID from token
        // In a real app, you'd verify JWT token
        const customerId = token; // Simplified for demo
        
        const customer = await Customer.findById(customerId);
        if (!customer) {
            return res.status(401).json({ 
                success: false, 
                message: 'Customer not found' 
            });
        }
        
        req.customer = customer;
        next();
    } catch (error) {
        console.error('Customer auth error:', error);
        res.status(401).json({ 
            success: false, 
            message: 'Authentication failed'
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

// @route   POST /api/event-registrations
// @desc    Register for an event
// @access  Private (Customer)
router.post('/', customerAuth, async (req, res) => {
    try {
        const {
            eventId,
            pricingTierName,
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

        // Check if event exists and is published
        const event = await Event.findOne({ 
            _id: eventId, 
            status: 'published' 
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

        // Check if slots are available
        if (pricingTier.slotsAvailable <= 0) {
            return res.status(400).json({
                success: false,
                message: 'No slots available for this pricing tier'
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

        // Calculate pricing with discount
        let finalPrice = pricingTier.price;
        let appliedDiscount = null;

        if (appliedDiscountName) {
            const discountOption = event.discountOptions.find(discount => discount.name === appliedDiscountName);
            if (discountOption) {
                appliedDiscount = {
                    name: discountOption.name,
                    percentageDiscount: discountOption.percentageDiscount,
                    originalPrice: pricingTier.price,
                    finalPrice: pricingTier.price * (1 - discountOption.percentageDiscount / 100)
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
            finalPrice
        });

        await registration.save();

        // Update event slots
        pricingTier.slotsAvailable -= 1;
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