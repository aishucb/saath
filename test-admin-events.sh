#!/bin/bash

# Admin Events API Test Script
# Make sure to replace YOUR_JWT_TOKEN with the actual token from login

BASE_URL="http://localhost:5000"
TOKEN="YOUR_JWT_TOKEN"  # Replace with actual token

echo "🚀 Testing Admin Events API"
echo "=========================="

# Test 1: Create Event
echo -e "\n1️⃣ Creating a new event..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin-events" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "Test Tech Conference",
    "date": "2024-03-15",
    "eventTime": {
      "from": "09:00",
      "to": "17:00"
    },
    "place": "Test Convention Center",
    "tags": ["test", "technology"],
    "pricing": [
      {
        "name": "Test Early Bird",
        "description": "Test pricing",
        "price": 99.00,
        "tags": ["test"],
        "slotsAvailable": 50
      }
    ],
    "discountOptions": [
      {
        "name": "Test Group Discount",
        "totalMembersNeeded": 5,
        "percentageDiscount": 15
      }
    ],
    "organizer": "Test Organizer",
    "description": "Test event description",
    "duration": "8 hours",
    "maxAttendees": 100,
    "availableSlots": 80,
    "status": "draft"
  }')

echo "Create Response: $CREATE_RESPONSE"

# Extract event ID from response
EVENT_ID=$(echo $CREATE_RESPONSE | grep -o '"_id":"[^"]*"' | cut -d'"' -f4)
echo "Event ID: $EVENT_ID"

# Test 2: Get All Events
echo -e "\n2️⃣ Getting all events..."
curl -s -X GET "$BASE_URL/api/admin-events" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Test 3: Get Single Event
echo -e "\n3️⃣ Getting single event..."
curl -s -X GET "$BASE_URL/api/admin-events/$EVENT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Test 4: Update Event
echo -e "\n4️⃣ Updating event..."
curl -s -X PUT "$BASE_URL/api/admin-events/$EVENT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "Updated Test Tech Conference",
    "status": "published"
  }' | jq '.'

# Test 5: Update Event Status
echo -e "\n5️⃣ Updating event status..."
curl -s -X PATCH "$BASE_URL/api/admin-events/$EVENT_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "published"
  }' | jq '.'

# Test 6: Get Event Statistics
echo -e "\n6️⃣ Getting event statistics..."
curl -s -X GET "$BASE_URL/api/admin-events/stats/overview" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Test 7: Search Events
echo -e "\n7️⃣ Searching events..."
curl -s -X GET "$BASE_URL/api/admin-events?search=tech" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Test 8: Delete Event
echo -e "\n8️⃣ Deleting event..."
curl -s -X DELETE "$BASE_URL/api/admin-events/$EVENT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

echo -e "\n✅ Testing completed!" 