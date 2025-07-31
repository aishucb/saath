# Admin Events API Documentation

This document describes the admin-events API endpoints for managing events in the Saath application.

## Authentication

All endpoints require admin authentication using JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Base URL

```
http://localhost:5000/api/admin-events
```

## Endpoints

### 1. Get All Events

**GET** `/api/admin-events`

Get a paginated list of all events with optional filtering and sorting.

**Query Parameters:**
- `status` (optional): Filter by status (`draft`, `published`, `cancelled`, `completed`)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search in eventName, description, place, organizer, or tags
- `sortBy` (optional): Sort field (default: `date`)
- `sortOrder` (optional): Sort order (`asc` or `desc`, default: `asc`)

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
      "image": "image_url",
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
      "attendees": [],
      "status": "published",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "createdBy": {
        "_id": "admin_id",
        "name": "Admin Name",
        "email": "admin@example.com"
      },
      "formattedDate": "2024-01-15",
      "formattedTime": "14:00 - 18:00",
      "attendeesCount": 0,
      "priceRange": {
        "min": 25.00,
        "max": 25.00,
        "currency": "USD"
      }
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 50,
    "itemsPerPage": 10
  }
}
```

### 2. Get Single Event

**GET** `/api/admin-events/:id`

Get a specific event by ID.

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
    "image": "image_url",
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
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 3. Create Event

**POST** `/api/admin-events`

Create a new event.

**Request Body:**
```json
{
  "eventName": "Event Name",
  "date": "2024-01-15",
  "eventTime": {
    "from": "14:00",
    "to": "18:00"
  },
  "place": "Event Location",
  "tags": ["social", "networking"],
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
  "pricing": [
    {
      "name": "Early Bird",
      "description": "Early bird pricing",
      "price": 25.00,
      "tags": ["early-bird"],
      "slotsAvailable": 50
    },
    {
      "name": "Regular",
      "description": "Regular pricing",
      "price": 35.00,
      "tags": ["regular"],
      "slotsAvailable": 100
    }
  ],
  "discountOptions": [
    {
      "name": "Group Discount",
      "totalMembersNeeded": 5,
      "percentageDiscount": 20
    },
    {
      "name": "Student Discount",
      "totalMembersNeeded": 1,
      "percentageDiscount": 15
    }
  ],
  "organizer": "Event Organizer",
  "description": "Event Description",
  "duration": "4 hours",
  "maxAttendees": 100,
  "availableSlots": 80,
  "status": "draft"
}
```

**Required Fields:**
- `eventName`: Event name
- `date`: Event date (YYYY-MM-DD format)
- `eventTime`: Object with `from` and `to` time (HH:MM format)
- `place`: Event location
- `organizer`: Event organizer name
- `description`: Event description
- `duration`: Event duration (e.g., "4 hours", "2 days")
- `maxAttendees`: Maximum number of attendees
- `availableSlots`: Number of available slots

**Optional Fields:**
- `tags`: Array of tags for the event
- `image`: Event image (data URL format: data:type/subtype;base64,encoded_data)
- `pricing`: Array of pricing options
- `discountOptions`: Array of discount options
- `status`: Event status (default: "draft")

**Pricing Structure:**
```json
{
  "name": "Pricing tier name",
  "description": "Pricing description",
  "price": 25.00,
  "tags": ["early-bird"],
  "slotsAvailable": 50
}
```

**Discount Options Structure:**
```json
{
  "name": "Discount name",
  "totalMembersNeeded": 5,
  "percentageDiscount": 20
}
```

**Response:**
```json
{
  "success": true,
  "message": "Event created successfully",
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
    "image": "image_url",
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
    "status": "draft",
    "createdBy": {
      "_id": "admin_id",
      "name": "Admin Name",
      "email": "admin@example.com"
    },
    "attendees": [],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 4. Update Event

**PUT** `/api/admin-events/:id`

Update an existing event. Only the event creator can update it.

**Request Body:** (All fields are optional)
```json
{
  "eventName": "Updated Event Name",
  "description": "Updated Event Description",
  "place": "Updated Event Location",
  "date": "2024-01-20",
  "eventTime": {
    "from": "15:00",
    "to": "19:00"
  },
  "organizer": "Updated Organizer",
  "duration": "4 hours",
  "maxAttendees": 150,
  "availableSlots": 120,
  "tags": ["business", "networking"],
  "image": "updated_image_url",
  "pricing": [
    {
      "name": "Updated Early Bird",
      "description": "Updated early bird pricing",
      "price": 30.00,
      "tags": ["early-bird"],
      "slotsAvailable": 60
    }
  ],
  "discountOptions": [
    {
      "name": "Updated Group Discount",
      "totalMembersNeeded": 10,
      "percentageDiscount": 25
    }
  ],
  "status": "published"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Event updated successfully",
  "data": {
    "_id": "event_id",
    "eventName": "Updated Event Name",
    "description": "Updated Event Description",
    "place": "Updated Event Location",
    "date": "2024-01-20T00:00:00.000Z",
    "eventTime": {
      "from": "15:00",
      "to": "19:00"
    },
    "organizer": "Updated Organizer",
    "duration": "4 hours",
    "maxAttendees": 150,
    "availableSlots": 120,
    "tags": ["business", "networking"],
    "image": "updated_image_url",
    "pricing": [
      {
        "name": "Updated Early Bird",
        "description": "Updated early bird pricing",
        "price": 30.00,
        "tags": ["early-bird"],
        "slotsAvailable": 60
      }
    ],
    "discountOptions": [
      {
        "name": "Updated Group Discount",
        "totalMembersNeeded": 10,
        "percentageDiscount": 25
      }
    ],
    "status": "published",
    "createdBy": {
      "_id": "admin_id",
      "name": "Admin Name",
      "email": "admin@example.com"
    },
    "attendees": [],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 5. Delete Event

**DELETE** `/api/admin-events/:id`

Delete an event. Only the event creator can delete it.

**Response:**
```json
{
  "success": true,
  "message": "Event deleted successfully"
}
```

### 6. Update Event Status

**PATCH** `/api/admin-events/:id/status`

Update the status of an event. Only the event creator can update it.

**Request Body:**
```json
{
  "status": "published"
}
```

**Valid Status Values:**
- `draft`: Event is in draft mode
- `published`: Event is published and visible
- `cancelled`: Event has been cancelled
- `completed`: Event has been completed

**Response:**
```json
{
  "success": true,
  "message": "Event status updated successfully",
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
    "image": "image_url",
    "pricing": [...],
    "discountOptions": [...],
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
    "attendees": [...],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 7. Get Event Statistics

**GET** `/api/admin-events/stats/overview`

Get overview statistics for events.

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 50,
    "published": 30,
    "draft": 10,
    "completed": 8,
    "cancelled": 2,
    "upcoming": 15,
    "recent": 8,
    "byTags": [
      {
        "_id": "social",
        "count": 20
      },
      {
        "_id": "business",
        "count": 15
      },
      {
        "_id": "networking",
        "count": 10
      },
      {
        "_id": "educational",
        "count": 5
      }
    ],
    "byOrganizer": [
      {
        "_id": "Tech Events Inc",
        "count": 12
      },
      {
        "_id": "Business Solutions",
        "count": 8
      }
    ],
    "byPlace": [
      {
        "_id": "Convention Center",
        "count": 15
      },
      {
        "_id": "Business Hub",
        "count": 10
      }
    ],
    "totalAttendees": 1250,
    "slotsAndPricing": {
      "totalMaxAttendees": 5000,
      "totalAvailableSlots": 4000,
      "totalPricingOptions": 150,
      "totalDiscountOptions": 30
    }
  }
}
```

## Error Responses

All endpoints return consistent error responses:

**401 Unauthorized:**
```json
{
  "success": false,
  "message": "No token provided"
}
```

**403 Forbidden:**
```json
{
  "success": false,
  "message": "Not authorized to update this event"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "message": "Event not found"
}
```

**400 Bad Request:**
```json
{
  "success": false,
  "message": "Please provide all required fields"
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "message": "Failed to create event",
  "error": "Error details (only in development)"
}
```

## Event Fields

### Required Fields
- `eventName`: The name of the event
- `date`: Event date in YYYY-MM-DD format
- `eventTime`: Object with `from` and `to` times in HH:MM format
- `place`: Event location/venue
- `organizer`: Name of the event organizer
- `description`: Detailed event description
- `duration`: Event duration (e.g., "4 hours", "2 days")
- `maxAttendees`: Maximum number of attendees allowed
- `availableSlots`: Number of slots currently available

### Optional Fields
- `tags`: Array of tags for categorizing and searching events
- `image`: URL to event image
- `pricing`: Array of pricing tiers with different options
- `discountOptions`: Array of discount options for group bookings

## Pricing Structure

Each pricing item includes:
- `name`: Name of the pricing tier (e.g., "Early Bird", "Regular", "VIP")
- `description`: Description of what's included
- `price`: Price amount (number)
- `tags`: Array of tags for the pricing tier
- `slotsAvailable`: Number of slots available for this pricing tier

## Discount Options Structure

Each discount option includes:
- `name`: Name of the discount (e.g., "Group Discount", "Student Discount")
- `totalMembersNeeded`: Minimum number of members required for the discount
- `percentageDiscount`: Discount percentage (1-100)

## Event Statuses

- `draft`: Event is being created/edited
- `published`: Event is live and visible to users
- `cancelled`: Event has been cancelled
- `completed`: Event has finished

## Notes

- All dates are stored in ISO format
- Time is stored as a string in HH:MM format
- Only the event creator (admin) can update or delete their events
- The API includes pagination for better performance with large datasets
- Search functionality works across eventName, description, place, organizer, and tags
- Statistics include upcoming events (next 30 days)
- Multiple pricing tiers can be added for different ticket types
- Discount options support group bookings and special offers 