/**
 * Public Events Routes
 * 
 * This module handles all public-facing event-related API endpoints.
 * These routes are accessible without authentication and provide
 * read-only access to published events.
 * 
 * Features:
 * - Browse published events with filtering and pagination
 * - Search events by name, description, place, organizer, or tags
 * - Get event details and statistics
 * - Featured and upcoming events
 * - Event categories and search suggestions
 * 
 * @author Saath Team
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Import database models
const { Event, Customer } = require('./models');

// Registration model is defined in eventRegistrationRoutes.js
// We can access it via mongoose.model('Registration')

// ============================================================================
// DEBUG ROUTES (FOR DEVELOPMENT)
// ============================================================================

/**
 * Get All Future Events (Debug Route)
 * GET /api/events/test
 * 
 * Retrieves all future events regardless of status for debugging purposes.
 * This route should be removed or protected in production.
 * 
 * @returns {Object} Array of future events with attendee counts
 */
router.get('/test', async (req, res) => {
    try {
        // Get only future events
        const now = new Date();
        const events = await Event.find({
            date: { $gt: now } // Only events with date greater than now
        })
            .populate('createdBy', 'name email')
            .select('-attendees')
            .sort({ date: 1 }); // Sort by date ascending

        // Calculate attendees count for each event
        const eventsWithAttendeesCount = await Promise.all(events.map(async (event) => {
            const eventObj = event.toObject();
            
            // Count total attendees from registrations
            const registrations = await mongoose.model('Registration').find({
                eventId: event._id,
                status: { $in: ['pending', 'confirmed'] }
            });
            
            const totalAttendees = registrations.reduce((sum, registration) => {
                return sum + (registration.attendeeCount || 1);
            }, 0);
            
            eventObj.attendeesCount = totalAttendees;
            return eventObj;
        }));

        res.json({
            success: true,
            data: eventsWithAttendeesCount,
            total: eventsWithAttendeesCount.length,
            message: 'Future events (including drafts)'
        });
    } catch (error) {
        console.error('Error fetching future events:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch events',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * Get Single Future Event by ID (Debug Route)
 * GET /api/events/test/:id
 * 
 * Retrieves a single future event by ID regardless of status for debugging.
 * This route should be removed or protected in production.
 * 
 * @param {string} id - Event ID
 * @returns {Object} Event details with attendee count
 */
router.get('/test/:id', async (req, res) => {
    try {
        const now = new Date();
        const event = await Event.findOne({ 
            _id: req.params.id,
            date: { $gt: now } // Only future events
        })
        .populate('createdBy', 'name email')
        .select('-attendees'); // Don't expose attendee list publicly

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found or is in the past'
            });
        }

        // Calculate attendees count for the event
        const eventObj = event.toObject();
        
        // Count total attendees from registrations
        const registrations = await mongoose.model('Registration').find({
            eventId: event._id,
            status: { $in: ['pending', 'confirmed'] }
        });
        
        const totalAttendees = registrations.reduce((sum, registration) => {
            return sum + (registration.attendeeCount || 1);
        }, 0);
        
        eventObj.attendeesCount = totalAttendees;

        res.json({
            success: true,
            data: eventObj
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

// ============================================================================
// PUBLIC EVENT BROWSING ROUTES
// ============================================================================

/**
 * Get All Published Events
 * GET /api/events
 * 
 * Retrieves all published events with advanced filtering, sorting, and pagination.
 * Supports search by text, tags, date range, and price range.
 * 
 * Query Parameters:
 * @param {number} page - Page number for pagination (default: 1)
 * @param {number} limit - Items per page (default: 10)
 * @param {string} search - Search term for event name, description, place, organizer, or tags
 * @param {string} tags - Comma-separated list of tags to filter by
 * @param {string} sortBy - Field to sort by (default: 'date')
 * @param {string} sortOrder - Sort order: 'asc' or 'desc' (default: 'asc')
 * @param {number} minPrice - Minimum price filter
 * @param {number} maxPrice - Maximum price filter
 * @param {string} dateFrom - Start date for date range filter
 * @param {string} dateTo - End date for date range filter
 * 
 * @returns {Object} Paginated list of events with metadata
 */
router.get('/', async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            search,
            tags,
            sortBy = 'date',
            sortOrder = 'asc',
            minPrice,
            maxPrice,
            dateFrom,
            dateTo
        } = req.query;

        // Build filter object - only published events
        const filter = { status: 'published' };
        
        // Add search filter if provided
        if (search) {
            filter.$or = [
                { eventName: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { place: { $regex: search, $options: 'i' } },
                { organizer: { $regex: search, $options: 'i' } },
                { tags: { $in: [new RegExp(search, 'i')] } }
            ];
        }

        // Add tags filter if provided
        if (tags) {
            const tagArray = tags.split(',').map(tag => tag.trim());
            filter.tags = { $in: tagArray };
        }

        // Add date range filter if provided
        if (dateFrom || dateTo) {
            filter.date = {};
            if (dateFrom) filter.date.$gte = new Date(dateFrom);
            if (dateTo) filter.date.$lte = new Date(dateTo);
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get events with pagination
        const events = await Event.find(filter)
            .populate('createdBy', 'name email')
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .select('-attendees'); // Don't expose attendee list publicly

        // Get total count for pagination
        const total = await Event.countDocuments(filter);

        // Calculate attendees count for each event
        const eventsWithAttendeesCount = await Promise.all(events.map(async (event) => {
            const eventObj = event.toObject();
            
            // Count total attendees from registrations
            const registrations = await mongoose.model('Registration').find({
                eventId: event._id,
                status: { $in: ['pending', 'confirmed'] }
            });
            
            const totalAttendees = registrations.reduce((sum, registration) => {
                return sum + (registration.attendeeCount || 1);
            }, 0);
            
            eventObj.attendeesCount = totalAttendees;
            return eventObj;
        }));

        // Filter by price range if specified
        let filteredEvents = eventsWithAttendeesCount;
        if (minPrice || maxPrice) {
            filteredEvents = eventsWithAttendeesCount.filter(event => {
                const minEventPrice = Math.min(...event.pricing.map(p => p.price));
                const maxEventPrice = Math.max(...event.pricing.map(p => p.price));
                
                if (minPrice && maxPrice) {
                    return minEventPrice >= parseFloat(minPrice) && maxEventPrice <= parseFloat(maxPrice);
                } else if (minPrice) {
                    return minEventPrice >= parseFloat(minPrice);
                } else if (maxPrice) {
                    return maxEventPrice <= parseFloat(maxPrice);
                }
                return true;
            });
        }

        res.json({
            success: true,
            data: filteredEvents,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching public events:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch events',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * Get Single Published Event by ID
 * GET /api/events/:id
 * 
 * Retrieves details of a single published event by its ID.
 * 
 * @param {string} id - Event ID
 * @returns {Object} Event details
 */
router.get('/:id', async (req, res) => {
    try {
        const event = await Event.findOne({ 
            _id: req.params.id, 
            status: 'published' 
        })
        .populate('createdBy', 'name email')
        .select('-attendees'); // Don't expose attendee list publicly

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found or not published'
            });
        }

        res.json({
            success: true,
            data: event
        });
    } catch (error) {
        console.error('Error fetching public event:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch event',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ============================================================================
// FEATURED AND UPCOMING EVENTS
// ============================================================================

/**
 * Get Featured Upcoming Events
 * GET /api/events/featured/upcoming
 * 
 * Retrieves featured upcoming events within the next 30 days.
 * Useful for homepage displays and promotional content.
 * 
 * Query Parameters:
 * @param {number} limit - Maximum number of events to return (default: 5)
 * 
 * @returns {Object} Array of upcoming events
 */
router.get('/featured/upcoming', async (req, res) => {
    try {
        const { limit = 5 } = req.query;
        
        // Get events in the next 30 days
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        
        const upcomingEvents = await Event.find({
            status: 'published',
            date: { 
                $gte: new Date(), 
                $lte: thirtyDaysFromNow 
            }
        })
        .populate('createdBy', 'name email')
        .sort({ date: 1 })
        .limit(parseInt(limit))
        .select('-attendees');

        res.json({
            success: true,
            data: upcomingEvents
        });
    } catch (error) {
        console.error('Error fetching upcoming events:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch upcoming events',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ============================================================================
// CATEGORIES AND TAGS
// ============================================================================

/**
 * Get All Available Tags
 * GET /api/events/categories/tags
 * 
 * Retrieves all unique tags used in published events with their counts.
 * Useful for building tag clouds and filtering interfaces.
 * 
 * @returns {Object} Array of tags with usage counts
 */
router.get('/categories/tags', async (req, res) => {
    try {
        const tags = await Event.aggregate([
            { $match: { status: 'published' } },
            { $unwind: '$tags' },
            {
                $group: {
                    _id: '$tags',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        res.json({
            success: true,
            data: tags.map(tag => ({
                name: tag._id,
                count: tag.count
            }))
        });
    } catch (error) {
        console.error('Error fetching tags:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tags',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ============================================================================
// SEARCH SUGGESTIONS
// ============================================================================

/**
 * Get Search Suggestions
 * GET /api/events/search/suggestions
 * 
 * Provides search suggestions based on event names, tags, and organizers.
 * Useful for autocomplete functionality in search interfaces.
 * 
 * Query Parameters:
 * @param {string} q - Search query (minimum 2 characters)
 * 
 * @returns {Object} Array of search suggestions with types and counts
 */
router.get('/search/suggestions', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.length < 2) {
            return res.json({
                success: true,
                data: []
            });
        }

        const suggestions = await Event.aggregate([
            { $match: { status: 'published' } },
            {
                $facet: {
                    eventNames: [
                        {
                            $match: {
                                eventName: { $regex: q, $options: 'i' }
                            }
                        },
                        {
                            $group: {
                                _id: '$eventName',
                                count: { $sum: 1 }
                            }
                        },
                        { $limit: 5 }
                    ],
                    tags: [
                        { $unwind: '$tags' },
                        {
                            $match: {
                                tags: { $regex: q, $options: 'i' }
                            }
                        },
                        {
                            $group: {
                                _id: '$tags',
                                count: { $sum: 1 }
                            }
                        },
                        { $limit: 5 }
                    ],
                    organizers: [
                        {
                            $match: {
                                organizer: { $regex: q, $options: 'i' }
                            }
                        },
                        {
                            $group: {
                                _id: '$organizer',
                                count: { $sum: 1 }
                            }
                        },
                        { $limit: 5 }
                    ]
                }
            }
        ]);

        const result = [
            ...suggestions[0].eventNames.map(item => ({ type: 'event', value: item._id, count: item.count })),
            ...suggestions[0].tags.map(item => ({ type: 'tag', value: item._id, count: item.count })),
            ...suggestions[0].organizers.map(item => ({ type: 'organizer', value: item._id, count: item.count }))
        ];

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error fetching search suggestions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch search suggestions',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get Public Event Statistics
 * GET /api/events/stats/public
 * 
 * Provides public statistics about events including counts, upcoming events,
 * monthly distribution, and price ranges.
 * 
 * @returns {Object} Event statistics and analytics
 */
router.get('/stats/public', async (req, res) => {
    try {
        const totalPublished = await Event.countDocuments({ status: 'published' });
        
        // Get upcoming events count
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        
        const upcomingCount = await Event.countDocuments({
            status: 'published',
            date: { $gte: new Date(), $lte: thirtyDaysFromNow }
        });

        // Get events by month (next 6 months)
        const sixMonthsFromNow = new Date();
        sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
        
        const eventsByMonth = await Event.aggregate([
            {
                $match: {
                    status: 'published',
                    date: { $gte: new Date(), $lte: sixMonthsFromNow }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$date' },
                        month: { $month: '$date' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        // Get price range statistics
        const priceStats = await Event.aggregate([
            { $match: { status: 'published' } },
            {
                $project: {
                    minPrice: { $min: '$pricing.price' },
                    maxPrice: { $max: '$pricing.price' }
                }
            },
            {
                $group: {
                    _id: null,
                    overallMinPrice: { $min: '$minPrice' },
                    overallMaxPrice: { $max: '$maxPrice' },
                    avgMinPrice: { $avg: '$minPrice' },
                    avgMaxPrice: { $avg: '$maxPrice' }
                }
            }
        ]);

        res.json({
            success: true,
            data: {
                totalPublished,
                upcomingCount,
                eventsByMonth: eventsByMonth.map(item => ({
                    month: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
                    count: item.count
                })),
                priceRange: priceStats[0] || {
                    overallMinPrice: 0,
                    overallMaxPrice: 0,
                    avgMinPrice: 0,
                    avgMaxPrice: 0
                }
            }
        });
    } catch (error) {
        console.error('Error fetching public stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router; 