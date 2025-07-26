# Admin Events API Testing Guide

This guide will help you test the new admin-events API endpoints.

## 🚀 Quick Start

### 1. Start the Server
```bash
cd server
npm start
```

### 2. Create Admin Account (if needed)
```bash
curl -X POST http://localhost:5000/api/admin/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "password123",
    "name": "Test Admin"
  }'
```

### 3. Login to Get Token
```bash
curl -X POST http://localhost:5000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "password123"
  }'
```

Save the token from the response for use in subsequent requests.

## 🧪 Testing Methods

### Method 1: Using the Test Scripts

#### Bash Script (Linux/Mac)
```bash
# Make script executable
chmod +x test-admin-events.sh

# Edit the script to add your JWT token
# Replace YOUR_JWT_TOKEN with the actual token

# Run the script
./test-admin-events.sh
```

#### Node.js Script
```bash
# Install axios if not already installed
npm install axios

# Run the test script
node test-admin-events.js
```

### Method 2: Manual Testing with cURL

#### 1. Create Event
```bash
curl -X POST http://localhost:5000/api/admin-events \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "Test Conference",
    "date": "2024-03-15",
    "eventTime": {
      "from": "09:00",
      "to": "17:00"
    },
    "place": "Test Venue",
    "tags": ["test", "conference"],
    "pricing": [
      {
        "name": "Early Bird",
        "description": "Limited offer",
        "price": 99.00,
        "tags": ["early-bird"],
        "slotsAvailable": 50
      }
    ],
    "discountOptions": [
      {
        "name": "Group Discount",
        "totalMembersNeeded": 5,
        "percentageDiscount": 15
      }
    ],
    "organizer": "Test Organizer",
    "description": "Test event",
    "duration": "8 hours",
    "maxAttendees": 100,
    "availableSlots": 80,
    "status": "draft"
  }'
```

#### 2. Get All Events
```bash
curl -X GET http://localhost:5000/api/admin-events \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 3. Get Single Event
```bash
curl -X GET http://localhost:5000/api/admin-events/EVENT_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 4. Update Event
```bash
curl -X PUT http://localhost:5000/api/admin-events/EVENT_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "Updated Test Conference",
    "status": "published"
  }'
```

#### 5. Update Event Status
```bash
curl -X PATCH http://localhost:5000/api/admin-events/EVENT_ID/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "published"
  }'
```

#### 6. Get Statistics
```bash
curl -X GET http://localhost:5000/api/admin-events/stats/overview \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 7. Search Events
```bash
curl -X GET "http://localhost:5000/api/admin-events?search=conference" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 8. Delete Event
```bash
curl -X DELETE http://localhost:5000/api/admin-events/EVENT_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Method 3: Using Postman/Insomnia

1. **Import the following requests:**

#### Login Request
```
POST http://localhost:5000/api/admin/login
Content-Type: application/json

{
  "email": "admin@test.com",
  "password": "password123"
}
```

#### Create Event Request
```
POST http://localhost:5000/api/admin-events
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "eventName": "Tech Conference 2024",
  "date": "2024-03-15",
  "eventTime": {
    "from": "09:00",
    "to": "17:00"
  },
  "place": "Convention Center",
  "tags": ["technology", "conference"],
  "pricing": [
    {
      "name": "Early Bird",
      "description": "Limited time offer",
      "price": 99.00,
      "tags": ["early-bird"],
      "slotsAvailable": 100
    }
  ],
  "discountOptions": [
    {
      "name": "Group Discount",
      "totalMembersNeeded": 5,
      "percentageDiscount": 15
    }
  ],
  "organizer": "Tech Events Inc",
  "description": "Annual technology conference",
  "duration": "8 hours",
  "maxAttendees": 300,
  "availableSlots": 250,
  "status": "draft"
}
```

2. **Set up environment variables:**
   - `baseUrl`: `http://localhost:5000`
   - `token`: (from login response)

3. **Use the collection runner for automated testing**

## 🔍 Testing Scenarios

### 1. Basic CRUD Operations
- ✅ Create event with all required fields
- ✅ Create event with optional fields (pricing, discounts)
- ✅ Get all events with pagination
- ✅ Get single event by ID
- ✅ Update event fields
- ✅ Delete event

### 2. Validation Testing
- ❌ Create event without required fields
- ❌ Create event with invalid date format
- ❌ Create event with invalid pricing structure
- ❌ Create event with invalid discount percentage (>100%)
- ❌ Update event with invalid data

### 3. Authentication Testing
- ❌ Access endpoints without token
- ❌ Access endpoints with invalid token
- ❌ Access endpoints with expired token

### 4. Authorization Testing
- ❌ Update event created by different admin
- ❌ Delete event created by different admin

### 5. Search and Filter Testing
- ✅ Search by event name
- ✅ Search by organizer
- ✅ Search by tags
- ✅ Filter by status
- ✅ Sort by different fields
- ✅ Pagination

### 6. Statistics Testing
- ✅ Get overview statistics
- ✅ Verify counts are accurate
- ✅ Check tag statistics

## 🐛 Common Issues

### 1. Authentication Errors
- **Issue**: "No token provided"
- **Solution**: Make sure to include `Authorization: Bearer YOUR_TOKEN` header

### 2. Validation Errors
- **Issue**: "Please provide all required fields"
- **Solution**: Check that all required fields are present in the request

### 3. Date Format Errors
- **Issue**: "Invalid date format"
- **Solution**: Use YYYY-MM-DD format for dates

### 4. Time Format Errors
- **Issue**: "eventTime must have both 'from' and 'to' fields"
- **Solution**: Ensure eventTime object has both from and to properties

### 5. Pricing Validation Errors
- **Issue**: "Pricing item must have name, price (number), and slotsAvailable"
- **Solution**: Check pricing array structure

## 📊 Expected Responses

### Successful Create Response
```json
{
  "success": true,
  "message": "Event created successfully",
  "data": {
    "_id": "event_id",
    "eventName": "Test Conference",
    "date": "2024-03-15T00:00:00.000Z",
    "eventTime": {
      "from": "09:00",
      "to": "17:00"
    },
    "place": "Test Venue",
    "tags": ["test", "conference"],
    "pricing": [...],
    "discountOptions": [...],
    "organizer": "Test Organizer",
    "description": "Test event",
    "duration": "8 hours",
    "maxAttendees": 100,
    "availableSlots": 80,
    "status": "draft",
    "createdBy": {...},
    "attendees": [],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Please provide all required fields"
}
```

## 🎯 Testing Checklist

- [ ] Server is running on port 5000
- [ ] Admin account exists and can login
- [ ] JWT token is valid and not expired
- [ ] All CRUD operations work
- [ ] Validation works for invalid data
- [ ] Authentication works for protected endpoints
- [ ] Authorization works (only creator can modify)
- [ ] Search and filtering work
- [ ] Statistics endpoint returns correct data
- [ ] Error responses are consistent

## 🚨 Troubleshooting

If you encounter issues:

1. **Check server logs** for detailed error messages
2. **Verify MongoDB connection** is working
3. **Check JWT token** is valid and not expired
4. **Validate request format** matches the schema
5. **Test with simpler data** first, then add complexity

Happy testing! 🎉 