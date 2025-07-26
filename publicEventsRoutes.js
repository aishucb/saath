const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Import models
const { Event, Customer } = require('./models');

// @route   GET /api/events
// @desc    Get all published events (public access)
// @access  Public
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
        
        if (search) {
            filter.$or = [
                { eventName: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { place: { $regex: search, $options: 'i' } },
                { organizer: { $regex: search, $options: 'i' } },
                { tags: { $in: [new RegExp(search, 'i')] } }
            ];
        }

        if (tags) {
            const tagArray = tags.split(',').map(tag => tag.trim());
            filter.tags = { $in: tagArray };
        }

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

        // Filter by price range if specified
        let filteredEvents = events;
        if (minPrice || maxPrice) {
            filteredEvents = events.filter(event => {
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

// @route   GET /api/events/:id
// @desc    Get single published event by ID (public access)
// @access  Public
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

// @route   GET /api/events/featured/upcoming
// @desc    Get featured upcoming events
// @access  Public
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

// @route   GET /api/events/categories/tags
// @desc    Get all available tags for filtering
// @access  Public
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

// @route   GET /api/events/search/suggestions
// @desc    Get search suggestions based on event names and tags
// @access  Public
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

// @route   GET /api/events/stats/public
// @desc    Get public event statistics
// @access  Public
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