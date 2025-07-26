const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Import models
const { Admin, Event } = require('./models');

// Authentication middleware (same as in adminRoutes.js)
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
            
            // Get admin ID from various possible locations in the token
            const adminId = decoded._id || 
                           (decoded.admin && decoded.admin.id) || 
                           decoded.id || 
                           (decoded.admin && decoded.admin._id);

            console.log(`🔍 [${requestId}] Extracted admin ID:`, adminId);

            if (!adminId) {
                const error = new Error('No admin ID found in token');
                console.error(`❌ [${requestId}] ${error.message}`);
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



// @route   GET /api/admin-events
// @desc    Get all events (with optional filters)
// @access  Private (Admin only)
router.get('/', auth, async (req, res) => {
    try {
        const { 
            status, 
            page = 1, 
            limit = 10, 
            search,
            sortBy = 'date',
            sortOrder = 'asc'
        } = req.query;

        // Build filter object
        const filter = {};
        if (status) filter.status = status;
        if (search) {
            filter.$or = [
                { eventName: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { place: { $regex: search, $options: 'i' } },
                { organizer: { $regex: search, $options: 'i' } },
                { tags: { $in: [new RegExp(search, 'i')] } }
            ];
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get events with pagination - all fields
        const events = await Event.find(filter)
            .populate('createdBy', 'name email')
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit));

        // Get total count for pagination
        const total = await Event.countDocuments(filter);

        // Process events to add computed fields
        const processedEvents = events.map(event => {
            const eventObj = event.toObject();
            
            // Add attendees count
            eventObj.attendeesCount = event.attendees ? event.attendees.length : 0;
            
            // Add price range
            if (event.pricing && event.pricing.length > 0) {
                const prices = event.pricing.map(p => p.price);
                eventObj.priceRange = {
                    min: Math.min(...prices),
                    max: Math.max(...prices),
                    currency: 'USD' // You can make this configurable
                };
            } else {
                eventObj.priceRange = {
                    min: 0,
                    max: 0,
                    currency: 'USD'
                };
            }
            
            // Add formatted date and time
            eventObj.formattedDate = event.date.toISOString().split('T')[0]; // YYYY-MM-DD
            eventObj.formattedTime = `${event.eventTime.from} - ${event.eventTime.to}`;
            
            return eventObj;
        });

        res.json({
            success: true,
            data: processedEvents,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch events',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// @route   GET /api/admin-events/:id
// @desc    Get single event by ID
// @access  Private (Admin only)
router.get('/:id', auth, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate('createdBy', 'name email')
            .populate('attendees', 'name email phone');

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        res.json({
            success: true,
            data: event
        });
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch event',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// @route   POST /api/admin-events
// @desc    Create a new event
// @access  Private (Admin only)
router.post('/', auth, async (req, res) => {
    try {
        const {
            eventName,
            date,
            eventTime,
            place,
            tags,
            image,
            pricing,
            discountOptions,
            organizer,
            description,
            duration,
            maxAttendees,
            availableSlots,
            status
        } = req.body;

        // Handle base64 data URL (any type)
        let imageData = null;
        if (image && image.startsWith('data:')) {
            imageData = image; // Store the complete data URL
        }

        // Validation for required fields
        if (!eventName || !date || !eventTime || !place || !organizer || !description || !duration || !maxAttendees || !availableSlots) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields: eventName, date, eventTime, place, organizer, description, duration, maxAttendees, availableSlots'
            });
        }

        // Validate eventTime structure
        if (!eventTime.from || !eventTime.to) {
            return res.status(400).json({
                success: false,
                message: 'eventTime must have both "from" and "to" fields'
            });
        }

        // Validate date
        const eventDate = new Date(date);
        if (isNaN(eventDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format'
            });
        }

        // Validate pricing array if provided
        if (pricing && Array.isArray(pricing)) {
            for (let i = 0; i < pricing.length; i++) {
                const priceItem = pricing[i];
                if (!priceItem.name || typeof priceItem.price !== 'number' || !priceItem.slotsAvailable) {
                    return res.status(400).json({
                        success: false,
                        message: `Pricing item ${i + 1} must have name, price (number), and slotsAvailable`
                    });
                }
            }
        }

        // Validate discount options array if provided
        if (discountOptions && Array.isArray(discountOptions)) {
            for (let i = 0; i < discountOptions.length; i++) {
                const discountItem = discountOptions[i];
                if (!discountItem.name || !discountItem.totalMembersNeeded || !discountItem.percentageDiscount) {
                    return res.status(400).json({
                        success: false,
                        message: `Discount option ${i + 1} must have name, totalMembersNeeded, and percentageDiscount`
                    });
                }
                if (discountItem.percentageDiscount < 1 || discountItem.percentageDiscount > 100) {
                    return res.status(400).json({
                        success: false,
                        message: `Discount percentage must be between 1 and 100`
                    });
                }
            }
        }

        // Create new event
        const event = new Event({
            eventName,
            date: eventDate,
            eventTime,
            place,
            tags: tags || [],
            image: imageData,
            pricing: pricing || [],
            discountOptions: discountOptions || [],
            organizer,
            description,
            duration,
            maxAttendees: parseInt(maxAttendees),
            availableSlots: parseInt(availableSlots),
            status: status || 'draft',
            createdBy: req.admin._id
        });

        await event.save();

        // Populate createdBy field
        await event.populate('createdBy', 'name email');

        res.status(201).json({
            success: true,
            message: 'Event created successfully',
            data: event
        });
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create event',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// @route   PUT /api/admin-events/:id
// @desc    Update an event
// @access  Private (Admin only)
router.put('/:id', auth, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Check if admin is the creator of the event
        if (event.createdBy.toString() !== req.admin._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this event'
            });
        }

        const {
            eventName,
            date,
            eventTime,
            place,
            tags,
            image,
            pricing,
            discountOptions,
            organizer,
            description,
            duration,
            maxAttendees,
            availableSlots,
            status
        } = req.body;

        // Handle base64 data URL (any type)
        let imageData = null;
        if (image && image.startsWith('data:')) {
            imageData = image; // Store the complete data URL
        }

        // Update fields
        if (eventName) event.eventName = eventName;
        if (description) event.description = description;
        if (place) event.place = place;
        if (organizer) event.organizer = organizer;
        if (duration) event.duration = duration;
        if (image !== undefined) event.image = imageData || image;
        if (status) event.status = status;
        
        if (date) {
            const eventDate = new Date(date);
            if (isNaN(eventDate.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid date format'
                });
            }
            event.date = eventDate;
        }
        
        if (eventTime) {
            if (!eventTime.from || !eventTime.to) {
                return res.status(400).json({
                    success: false,
                    message: 'eventTime must have both "from" and "to" fields'
                });
            }
            event.eventTime = eventTime;
        }
        
        if (tags !== undefined) event.tags = tags;
        if (maxAttendees) event.maxAttendees = parseInt(maxAttendees);
        if (availableSlots) event.availableSlots = parseInt(availableSlots);
        
        if (pricing !== undefined) {
            // Validate pricing array if provided
            if (Array.isArray(pricing)) {
                for (let i = 0; i < pricing.length; i++) {
                    const priceItem = pricing[i];
                    if (!priceItem.name || typeof priceItem.price !== 'number' || !priceItem.slotsAvailable) {
                        return res.status(400).json({
                            success: false,
                            message: `Pricing item ${i + 1} must have name, price (number), and slotsAvailable`
                        });
                    }
                }
            }
            event.pricing = pricing;
        }
        
        if (discountOptions !== undefined) {
            // Validate discount options array if provided
            if (Array.isArray(discountOptions)) {
                for (let i = 0; i < discountOptions.length; i++) {
                    const discountItem = discountOptions[i];
                    if (!discountItem.name || !discountItem.totalMembersNeeded || !discountItem.percentageDiscount) {
                        return res.status(400).json({
                            success: false,
                            message: `Discount option ${i + 1} must have name, totalMembersNeeded, and percentageDiscount`
                        });
                    }
                    if (discountItem.percentageDiscount < 1 || discountItem.percentageDiscount > 100) {
                        return res.status(400).json({
                            success: false,
                            message: `Discount percentage must be between 1 and 100`
                        });
                    }
                }
            }
            event.discountOptions = discountOptions;
        }

        await event.save();
        await event.populate('createdBy', 'name email');

        res.json({
            success: true,
            message: 'Event updated successfully',
            data: event
        });
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update event',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// @route   DELETE /api/admin-events/:id
// @desc    Delete an event
// @access  Private (Admin only)
router.delete('/:id', auth, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Check if admin is the creator of the event
        if (event.createdBy.toString() !== req.admin._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this event'
            });
        }

        await Event.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Event deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete event',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// @route   PATCH /api/admin-events/:id/status
// @desc    Update event status
// @access  Private (Admin only)
router.patch('/:id/status', auth, async (req, res) => {
    try {
        const { status } = req.body;

        if (!status || !['draft', 'published', 'cancelled', 'completed'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be one of: draft, published, cancelled, completed'
            });
        }

        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Check if admin is the creator of the event
        if (event.createdBy.toString() !== req.admin._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this event'
            });
        }

        event.status = status;
        await event.save();
        await event.populate('createdBy', 'name email');
        await event.populate('attendees', 'name email phone');

        res.json({
            success: true,
            message: 'Event status updated successfully',
            data: event
        });
    } catch (error) {
        console.error('Error updating event status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update event status',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// @route   GET /api/admin-events/stats/overview
// @desc    Get event statistics
// @access  Private (Admin only)
router.get('/stats/overview', auth, async (req, res) => {
    try {
        const totalEvents = await Event.countDocuments();
        const publishedEvents = await Event.countDocuments({ status: 'published' });
        const draftEvents = await Event.countDocuments({ status: 'draft' });
        const completedEvents = await Event.countDocuments({ status: 'completed' });
        const cancelledEvents = await Event.countDocuments({ status: 'cancelled' });

        // Get events by tags (most common tags)
        const tagStats = await Event.aggregate([
            { $unwind: '$tags' },
            {
                $group: {
                    _id: '$tags',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        // Get upcoming events (next 30 days)
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        
        const upcomingEvents = await Event.countDocuments({
            date: { $gte: new Date(), $lte: thirtyDaysFromNow },
            status: 'published'
        });

        // Get total slots and pricing info
        const slotsAndPricing = await Event.aggregate([
            {
                $group: {
                    _id: null,
                    totalMaxAttendees: { $sum: '$maxAttendees' },
                    totalAvailableSlots: { $sum: '$availableSlots' },
                    totalPricingOptions: { $sum: { $size: '$pricing' } },
                    totalDiscountOptions: { $sum: { $size: '$discountOptions' } }
                }
            }
        ]);

        // Get events by organizer (most active organizers)
        const organizerStats = await Event.aggregate([
            {
                $group: {
                    _id: '$organizer',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        // Get events by place (most popular venues)
        const placeStats = await Event.aggregate([
            {
                $group: {
                    _id: '$place',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        // Get total attendees across all events
        const totalAttendees = await Event.aggregate([
            {
                $group: {
                    _id: null,
                    totalAttendees: { $sum: { $size: '$attendees' } }
                }
            }
        ]);

        // Get events created in last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentEvents = await Event.countDocuments({
            createdAt: { $gte: thirtyDaysAgo }
        });

        res.json({
            success: true,
            data: {
                total: totalEvents,
                published: publishedEvents,
                draft: draftEvents,
                completed: completedEvents,
                cancelled: cancelledEvents,
                upcoming: upcomingEvents,
                recent: recentEvents,
                byTags: tagStats,
                byOrganizer: organizerStats,
                byPlace: placeStats,
                totalAttendees: totalAttendees[0]?.totalAttendees || 0,
                slotsAndPricing: slotsAndPricing[0] || {
                    totalMaxAttendees: 0,
                    totalAvailableSlots: 0,
                    totalPricingOptions: 0,
                    totalDiscountOptions: 0
                }
            }
        });
    } catch (error) {
        console.error('Error fetching event stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch event statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router; 