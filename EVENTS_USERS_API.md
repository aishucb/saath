# Events Users API Documentation

This document describes the events-users API endpoints for users to browse and view events in the Saath application.

## Authentication

All endpoints require user authentication using JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

**Note**: User authentication differs from admin authentication. Users are authenticated as customers, not admins.

## Base URL

```
http://localhost:5000/api/events-users
```

## Endpoints

### 1. Get All Events (User View)

**GET** `/api/events-users`

Get a paginated list of all published events with enhanced search and filtering options for users.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search in eventName, description, place, organizer, or tags
- `sortBy` (optional): Sort field (default: `date`)
- `sortOrder` (optional): Sort order (`asc` or `desc`, default: `asc`)
- `minPrice` (optional): Minimum price filter
- `maxPrice` (optional): Maximum price filter
- `dateFrom` (optional): Start date filter (YYYY-MM-DD)
- `dateTo` (optional): End date filter (YYYY-MM-DD)
- `tags` (optional): Comma-separated list of tags to filter by
- `organizer` (optional): Filter by organizer name
- `place` (optional): Filter by event place

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "event_id",
      "eventName": "Event Name",
      "date": "2024-01-15T00:00:00.000Z",
      "eventTime": {
        "from": "14:00",
        "to": "18:00"
      },
      "place": "Event Location",
      "tags": ["social", "networking"],
      "image": "data:image/jpeg;base64,...",
      "pricing": [
        {
          "name": "Early Bird",
          "description": "Early bird pricing",
          "price": 25.00,
          "tags": ["early-bird"],
          "slotsAvailable": 50
        }
      ],
      "discountOptions": [
        {
          "name": "Group Discount",
          "totalMembersNeeded": 5,
          "percentageDiscount": 20
        }
      ],
      "organizer": "Event Organizer",
      "description": "Event Description",
      "duration": "4 hours",
      "maxAttendees": 100,
      "availableSlots": 80,
      "status": "published",
      "createdBy": {
        "_id": "admin_id",
        "name": "Admin Name",
        "email": "admin@example.com"
      },
      "attendees": [],
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "formattedDate": "2024-01-15",
      "formattedTime": "14:00 - 18:00",
      "attendeesCount": 0,
      "priceRange": {
        "min": 25.00,
        "max": 25.00,
        "currency": "USD"
      },
      "isRegistered": false
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 50,
    "itemsPerPage": 10
  },
  "filters": {
    "applied": {
      "search": "tech",
      "minPrice": 20,
      "maxPrice": 100,
      "dateFrom": "2024-01-01",
      "dateTo": "2024-12-31",
      "tags": ["technology", "conference"],
      "organizer": "Tech Events Inc",
      "place": "Convention Center"
    }
  }
}
```

### 2. Get Single Event

**GET** `/api/events-users/:id`

Get a specific published event by ID with complete details and user registration status.

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "event_id",
    "eventName": "Event Name",
    "date": "2024-01-15T00:00:00.000Z",
    "eventTime": {
      "from": "14:00",
      "to": "18:00"
    },
    "place": "Event Location",
    "tags": ["social", "networking"],
    "image": "data:image/jpeg;base64,...",
    "pricing": [
      {
        "name": "Early Bird",
        "description": "Early bird pricing",
        "price": 25.00,
        "tags": ["early-bird"],
        "slotsAvailable": 50
      }
    ],
    "discountOptions": [
      {
        "name": "Group Discount",
        "totalMembersNeeded": 5,
        "percentageDiscount": 20
      }
    ],
    "organizer": "Event Organizer",
    "description": "Event Description",
    "duration": "4 hours",
    "maxAttendees": 100,
    "availableSlots": 80,
    "status": "published",
    "createdBy": {
      "_id": "admin_id",
      "name": "Admin Name",
      "email": "admin@example.com"
    },
    "attendees": [
      {
        "_id": "customer_id",
        "name": "Customer Name",
        "email": "customer@example.com",
        "phone": "+1234567890"
      }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "isRegistered": true,
    "userRegistration": {
      "registeredAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### 3. Get Search Suggestions

**GET** `/api/events-users/search/suggestions`

Get search suggestions for events, tags, organizers, and places.

**Query Parameters:**
- `q` (required): Search query (minimum 2 characters)

**Response:**
```json
{
  "success": true,
  "data": {
    "events": [
      "Tech Conference 2024",
      "Technology Summit"
    ],
    "tags": [
      "technology",
      "tech",
      "conference"
    ],
    "organizers": [
      "Tech Events Inc",
      "Technology Solutions"
    ],
    "places": [
      "Convention Center",
      "Tech Hub"
    ]
  }
}
```

### 4. Get Filter Options

**GET** `/api/events-users/filters/options`

Get available filter options for events.

**Response:**
```json
{
  "success": true,
  "data": {
    "tags": [
      "technology",
      "business",
      "networking",
      "social",
      "educational"
    ],
    "organizers": [
      "Tech Events Inc",
      "Business Solutions",
      "Networking Hub"
    ],
    "places": [
      "Convention Center",
      "Business Hub",
      "Tech Campus"
    ],
    "priceRange": {
      "minPrice": 0,
      "maxPrice": 500
    }
  }
}
```

## User-Specific Features

### Authentication Differences

**User Authentication:**
- Uses customer ID from JWT token
- Token contains customer information
- Access limited to published events only
- User-specific data included in responses

**Admin Authentication:**
- Uses admin ID from JWT token
- Token contains admin information
- Access to all events (draft, published, etc.)
- Admin-specific data included in responses

### User-Specific Data

Each event response includes user-specific information:

- `isRegistered`: Boolean indicating if the current user is registered for the event
- `userRegistration`: Registration details if the user is registered
- `attendeesCount`: Total number of attendees
- `priceRange`: Min/max price range for the event

### Enhanced Filtering

Users can filter events by:

1. **Text Search**: Search across event name, description, place, organizer, and tags
2. **Price Range**: Filter by minimum and maximum price
3. **Date Range**: Filter by event date range
4. **Tags**: Filter by specific tags
5. **Organizer**: Filter by event organizer
6. **Place**: Filter by event location
7. **Sorting**: Sort by various fields in ascending or descending order

### Search Suggestions

The search suggestions endpoint provides:

- **Event Names**: Matching event names
- **Tags**: Matching event tags
- **Organizers**: Matching organizer names
- **Places**: Matching event locations

## Error Responses

All endpoints return consistent error responses:

**401 Unauthorized:**
```json
{
  "success": false,
  "message": "No token provided"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "message": "Event not found or not available"
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "message": "Failed to fetch events",
  "error": "Error details (development only)"
}
```

## Example Usage

### Get All Events with Filters
```bash
curl -X GET "http://localhost:5000/api/events-users?search=tech&minPrice=20&maxPrice=100&tags=technology,conference&limit=5" \
  -H "Authorization: Bearer YOUR_USER_TOKEN"
```

### Get Single Event
```bash
curl -X GET "http://localhost:5000/api/events-users/EVENT_ID" \
  -H "Authorization: Bearer YOUR_USER_TOKEN"
```

### Get Search Suggestions
```bash
curl -X GET "http://localhost:5000/api/events-users/search/suggestions?q=tech" \
  -H "Authorization: Bearer YOUR_USER_TOKEN"
```

### Get Filter Options
```bash
curl -X GET "http://localhost:5000/api/events-users/filters/options" \
  -H "Authorization: Bearer YOUR_USER_TOKEN"
```

## Key Features

✅ **User Authentication** - Customer-based authentication  
✅ **Published Events Only** - Only shows published events to users  
✅ **Enhanced Search** - Full-text search across multiple fields  
✅ **Advanced Filtering** - Multiple filter options  
✅ **User-Specific Data** - Registration status and user context  
✅ **Search Suggestions** - Auto-complete suggestions  
✅ **Filter Options** - Available filter values  
✅ **Pagination** - Efficient data loading  
✅ **Computed Fields** - Formatted dates, price ranges, etc.  
✅ **Complete Event Data** - All event details for users 