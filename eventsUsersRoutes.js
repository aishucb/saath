const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Import models
const { Customer, Event } = require('./models');

// User Authentication middleware
const userAuth = async (req, res, next) => {
    const requestId = Math.random().toString(36).substring(2, 8);
    console.log(`[${requestId}] User auth check for: ${req.method} ${req.path}`);
    
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
            console.log(`🔍 [${requestId}] Verifying user token...`);
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
        console.error(`❌ [${requestId || 'unknown'}] Unexpected error in user auth middleware:`, {
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

// @route   GET /api/events-users
// @desc    Get all published events with enhanced search/filter options for users
// @access  Private (User only)
router.get('/', userAuth, async (req, res) => {
    try {
        const { 
            status = 'published', 
            page = 1, 
            limit = 10, 
            search,
            sortBy = 'date',
            sortOrder = 'asc',
            minPrice,
            maxPrice,
            dateFrom,
            dateTo,
            tags,
            organizer,
            place
        } = req.query;

        // Build filter object - only published events for users
        const filter = { status: 'published' };
        
        // Search functionality
        if (search) {
            filter.$or = [
                { eventName: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { place: { $regex: search, $options: 'i' } },
                { organizer: { $regex: search, $options: 'i' } },
                { tags: { $in: [new RegExp(search, 'i')] } }
            ];
        }

        // Price range filtering
        if (minPrice || maxPrice) {
            filter['pricing.price'] = {};
            if (minPrice) filter['pricing.price'].$gte = parseFloat(minPrice);
            if (maxPrice) filter['pricing.price'].$lte = parseFloat(maxPrice);
        }

        // Date range filtering
        if (dateFrom || dateTo) {
            filter.date = {};
            if (dateFrom) filter.date.$gte = new Date(dateFrom);
            if (dateTo) filter.date.$lte = new Date(dateTo);
        }

        // Tag filtering
        if (tags) {
            const tagArray = tags.split(',').map(tag => tag.trim());
            filter.tags = { $in: tagArray };
        }

        // Organizer filtering
        if (organizer) {
            filter.organizer = { $regex: organizer, $options: 'i' };
        }

        // Place filtering
        if (place) {
            filter.place = { $regex: place, $options: 'i' };
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get events with pagination - all fields for users
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
                    currency: 'USD'
                };
            } else {
                eventObj.priceRange = {
                    min: 0,
                    max: 0,
                    currency: 'USD'
                };
            }
            
            // Add formatted date and time
            eventObj.formattedDate = event.date.toISOString().split('T')[0];
            eventObj.formattedTime = `${event.eventTime.from} - ${event.eventTime.to}`;
            
            // Check if current user is registered for this event
            eventObj.isRegistered = event.attendees && event.attendees.some(attendee => 
                attendee.toString() === req.customer._id.toString()
            );
            
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
            },
            filters: {
                applied: {
                    search,
                    minPrice,
                    maxPrice,
                    dateFrom,
                    dateTo,
                    tags: tags ? tags.split(',').map(tag => tag.trim()) : undefined,
                    organizer,
                    place
                }
            }
        });
    } catch (error) {
        console.error('Error fetching events for users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch events',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// @route   GET /api/events-users/:id
// @desc    Get single published event with complete details for users
// @access  Private (User only)
router.get('/:id', userAuth, async (req, res) => {
    try {
        const event = await Event.findOne({ 
            _id: req.params.id, 
            status: 'published' 
        })
        .populate('createdBy', 'name email')
        .populate('attendees', 'name email phone');

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found or not available'
            });
        }

        // Check if current user is registered for this event
        const isRegistered = event.attendees && event.attendees.some(attendee => 
            attendee._id.toString() === req.customer._id.toString()
        );

        // Add user-specific data to response
        const eventData = event.toObject();
        eventData.isRegistered = isRegistered;
        eventData.userRegistration = null;

        // If user is registered, get their registration details
        if (isRegistered) {
            // You can add registration details here if you have a separate registration model
            eventData.userRegistration = {
                registeredAt: event.attendees.find(attendee => 
                    attendee._id.toString() === req.customer._id.toString()
                )?.registeredAt || event.createdAt
            };
        }

        res.json({
            success: true,
            data: eventData
        });
    } catch (error) {
        console.error('Error fetching event for user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch event',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// @route   GET /api/events-users/search/suggestions
// @desc    Get search suggestions for events
// @access  Private (User only)
router.get('/search/suggestions', userAuth, async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.length < 2) {
            return res.json({
                success: true,
                data: {
                    events: [],
                    tags: [],
                    organizers: [],
                    places: []
                }
            });
        }

        // Get event name suggestions
        const eventSuggestions = await Event.find({
            status: 'published',
            eventName: { $regex: q, $options: 'i' }
        })
        .select('eventName')
        .limit(5);

        // Get tag suggestions
        const tagSuggestions = await Event.aggregate([
            { $match: { status: 'published' } },
            { $unwind: '$tags' },
            { $match: { tags: { $regex: q, $options: 'i' } } },
            { $group: { _id: '$tags' } },
            { $limit: 5 }
        ]);

        // Get organizer suggestions
        const organizerSuggestions = await Event.find({
            status: 'published',
            organizer: { $regex: q, $options: 'i' }
        })
        .select('organizer')
        .limit(5);

        // Get place suggestions
        const placeSuggestions = await Event.find({
            status: 'published',
            place: { $regex: q, $options: 'i' }
        })
        .select('place')
        .limit(5);

        res.json({
            success: true,
            data: {
                events: eventSuggestions.map(e => e.eventName),
                tags: tagSuggestions.map(t => t._id),
                organizers: [...new Set(organizerSuggestions.map(o => o.organizer))],
                places: [...new Set(placeSuggestions.map(p => p.place))]
            }
        });
    } catch (error) {
        console.error('Error getting search suggestions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get search suggestions',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// @route   GET /api/events-users/filters/options
// @desc    Get available filter options for events
// @access  Private (User only)
router.get('/filters/options', userAuth, async (req, res) => {
    try {
        // Get all unique tags
        const tags = await Event.aggregate([
            { $match: { status: 'published' } },
            { $unwind: '$tags' },
            { $group: { _id: '$tags' } },
            { $sort: { _id: 1 } }
        ]);

        // Get all unique organizers
        const organizers = await Event.aggregate([
            { $match: { status: 'published' } },
            { $group: { _id: '$organizer' } },
            { $sort: { _id: 1 } }
        ]);

        // Get all unique places
        const places = await Event.aggregate([
            { $match: { status: 'published' } },
            { $group: { _id: '$place' } },
            { $sort: { _id: 1 } }
        ]);

        // Get price range
        const priceRange = await Event.aggregate([
            { $match: { status: 'published' } },
            { $unwind: '$pricing' },
            {
                $group: {
                    _id: null,
                    minPrice: { $min: '$pricing.price' },
                    maxPrice: { $max: '$pricing.price' }
                }
            }
        ]);

        res.json({
            success: true,
            data: {
                tags: tags.map(t => t._id),
                organizers: organizers.map(o => o._id),
                places: places.map(p => p._id),
                priceRange: priceRange[0] || { minPrice: 0, maxPrice: 0 }
            }
        });
    } catch (error) {
        console.error('Error getting filter options:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get filter options',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// @route   PUT /api/events-users/:id/update-slots
// @desc    Update available slots for an event based on number of registrations
// @access  Private (User only)
router.put('/:id/update-slots', userAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { registrationsCount } = req.body;

        console.log(`🔍 [${req.requestId}] Updating slots for event ${id} with ${registrationsCount} registrations`);

        // Validate input
        if (typeof registrationsCount !== 'number' || registrationsCount < 0) {
            return res.status(400).json({
                success: false,
                message: 'registrationsCount must be a non-negative number'
            });
        }

        // Find the event
        const event = await Event.findById(id);
        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Check if user has permission to update this event
        // (Optional: Add organizer check if needed)
        // if (event.createdBy.toString() !== req.customer._id.toString()) {
        //     return res.status(403).json({
        //         success: false,
        //         message: 'Not authorized to update this event'
        //     });
        // }

        // Calculate new available slots
        const maxAttendees = event.maxAttendees;
        const newAvailableSlots = Math.max(0, maxAttendees - registrationsCount);

        console.log(`🔍 [${req.requestId}] Event: ${event.eventName}`);
        console.log(`🔍 [${req.requestId}] Max attendees: ${maxAttendees}`);
        console.log(`🔍 [${req.requestId}] Current available slots: ${event.availableSlots}`);
        console.log(`🔍 [${req.requestId}] New registrations count: ${registrationsCount}`);
        console.log(`🔍 [${req.requestId}] New available slots: ${newAvailableSlots}`);

        // Update the event with new available slots
        const updatedEvent = await Event.findByIdAndUpdate(
            id,
            { 
                availableSlots: newAvailableSlots,
                attendeesCount: registrationsCount
            },
            { new: true }
        ).populate('createdBy', 'name email');

        if (!updatedEvent) {
            return res.status(500).json({
                success: false,
                message: 'Failed to update event slots'
            });
        }

        console.log(`✅ [${req.requestId}] Successfully updated slots for event ${id}`);

        res.json({
            success: true,
            message: 'Available slots updated successfully',
            data: {
                eventId: updatedEvent._id,
                eventName: updatedEvent.eventName,
                maxAttendees: updatedEvent.maxAttendees,
                availableSlots: updatedEvent.availableSlots,
                attendeesCount: updatedEvent.attendeesCount,
                updatedAt: updatedEvent.updatedAt
            }
        });

    } catch (error) {
        console.error(`❌ [${req.requestId || 'unknown'}] Error updating event slots:`, error);
        res.status(500).json({
            success: false,
            message: 'Failed to update available slots',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router; 