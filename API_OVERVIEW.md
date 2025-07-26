# Saath API Overview

This document provides an overview of all the APIs available in the Saath application.

## 🔐 Authentication

### Admin Authentication
- **JWT Token**: Required for admin endpoints
- **Header**: `Authorization: Bearer <token>`
- **Login**: `POST /api/admin/login`
- **Register**: `POST /api/admin/register`

### Customer Authentication
- **JWT Token**: Required for customer endpoints
- **Header**: `Authorization: Bearer <token>`
- **Login**: `POST /api/customer/login` (to be implemented)

## 📋 API Endpoints

### 1. Admin Events Management API
**Base URL**: `/api/admin-events`

#### Endpoints:
- `GET /` - Get all events (with filters, pagination)
- `GET /:id` - Get single event
- `POST /` - Create new event
- `PUT /:id` - Update event
- `DELETE /:id` - Delete event
- `PATCH /:id/status` - Update event status
- `GET /stats/overview` - Get event statistics

#### Features:
- ✅ Complete CRUD operations
- ✅ Multiple pricing tiers
- ✅ Discount options
- ✅ Event status management
- ✅ Search and filtering
- ✅ Statistics dashboard
- ✅ Admin-only access

---

### 2. Public Events API
**Base URL**: `/api/events`

#### Endpoints:
- `GET /` - Get published events (public access)
- `GET /:id` - Get single published event
- `GET /featured/upcoming` - Get upcoming featured events
- `GET /categories/tags` - Get available tags
- `GET /search/suggestions` - Get search suggestions
- `GET /stats/public` - Get public statistics

#### Features:
- ✅ Public access (no authentication required)
- ✅ Search and filtering
- ✅ Price range filtering
- ✅ Date range filtering
- ✅ Tag-based filtering
- ✅ Search suggestions
- ✅ Featured events
- ✅ Public statistics

---

### 3. Event Registration API
**Base URL**: `/api/event-registrations`

#### Endpoints:
- `POST /` - Register for an event
- `GET /my-registrations` - Get customer's registrations
- `GET /:id` - Get single registration
- `PATCH /:id/cancel` - Cancel registration
- `PATCH /:id/check-in` - Check in attendee (admin)

#### Features:
- ✅ Event registration
- ✅ Pricing tier selection
- ✅ Discount application
- ✅ Registration management
- ✅ Check-in functionality
- ✅ Slot management
- ✅ Payment status tracking

---

### 4. Existing APIs

#### Forum API
**Base URL**: `/api/forum`
- Forum management and discussions

#### Chat API
**Base URL**: `/api/chat`
- Real-time messaging

#### Followers API
**Base URL**: `/followers`
- User following system

## 🚀 Next APIs to Implement

### 5. Event Reviews & Ratings API
**Base URL**: `/api/event-reviews`

#### Planned Endpoints:
- `POST /` - Post review
- `GET /event/:eventId` - Get event reviews
- `PUT /:id` - Update review
- `DELETE /:id` - Delete review
- `GET /stats/:eventId` - Get review statistics

#### Features:
- ⏳ Review posting
- ⏳ Rating system
- ⏳ Review moderation
- ⏳ Review statistics

---

### 6. Event Notifications API
**Base URL**: `/api/event-notifications`

#### Planned Endpoints:
- `POST /send` - Send notification
- `GET /my-notifications` - Get user notifications
- `PATCH /:id/read` - Mark as read
- `DELETE /:id` - Delete notification

#### Features:
- ⏳ Event reminders
- ⏳ Status updates
- ⏳ Email notifications
- ⏳ SMS notifications

---

### 7. Payment Integration API
**Base URL**: `/api/payments`

#### Planned Endpoints:
- `POST /create-payment` - Create payment
- `POST /webhook` - Payment webhook
- `GET /payment-status/:id` - Get payment status
- `POST /refund` - Process refund

#### Features:
- ⏳ Payment processing
- ⏳ Multiple payment methods
- ⏳ Refund handling
- ⏳ Payment webhooks

---

### 8. Event Analytics API
**Base URL**: `/api/event-analytics`

#### Planned Endpoints:
- `GET /event/:id/analytics` - Get event analytics
- `GET /organizer/analytics` - Get organizer analytics
- `GET /revenue/analytics` - Get revenue analytics

#### Features:
- ⏳ Event performance metrics
- ⏳ Revenue tracking
- ⏳ Attendee analytics
- ⏳ Conversion rates

## 📊 Data Models

### Event Model
```javascript
{
  eventName: String,
  date: Date,
  eventTime: { from: String, to: String },
  place: String,
  tags: [String],
  image: String,
  pricing: [{
    name: String,
    description: String,
    price: Number,
    tags: [String],
    slotsAvailable: Number
  }],
  discountOptions: [{
    name: String,
    totalMembersNeeded: Number,
    percentageDiscount: Number
  }],
  organizer: String,
  description: String,
  duration: String,
  maxAttendees: Number,
  availableSlots: Number,
  status: String,
  createdBy: ObjectId,
  attendees: [ObjectId]
}
```

### Registration Model
```javascript
{
  eventId: ObjectId,
  customerId: ObjectId,
  pricingTier: {
    name: String,
    price: Number,
    description: String
  },
  appliedDiscount: {
    name: String,
    percentageDiscount: Number,
    originalPrice: Number,
    finalPrice: Number
  },
  registrationDate: Date,
  status: String,
  paymentStatus: String,
  specialRequests: String,
  checkInStatus: String,
  checkInTime: Date
}
```

## 🔧 Testing

### Test Scripts Available:
1. **`test-admin-events.sh`** - Bash script for admin events testing
2. **`test-admin-events.js`** - Node.js script for admin events testing
3. **`test-admin-events.ps1`** - PowerShell script for admin events testing

### Testing Tools:
- **Postman/Insomnia** - API testing
- **cURL** - Command line testing
- **Custom scripts** - Automated testing

## 🛡️ Security Features

### Authentication:
- JWT token-based authentication
- Role-based access control
- Token expiration handling

### Authorization:
- Admin-only endpoints
- Customer-specific data access
- Event creator permissions

### Validation:
- Input validation
- Data sanitization
- Error handling

## 📈 Performance Features

### Pagination:
- All list endpoints support pagination
- Configurable page size
- Total count information

### Filtering:
- Search functionality
- Status filtering
- Date range filtering
- Price range filtering

### Caching:
- Response caching (to be implemented)
- Database query optimization

## 🚀 Deployment

### Environment Variables:
- `JWT_SECRET` - JWT signing secret
- `MONGODB_URI` - MongoDB connection string
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port

### Production Considerations:
- HTTPS enforcement
- Rate limiting
- CORS configuration
- Error logging
- Monitoring

## 📝 API Documentation

### Available Documentation:
1. **`ADMIN_EVENTS_API.md`** - Admin events API documentation
2. **`TESTING_GUIDE.md`** - Testing guide
3. **`API_OVERVIEW.md`** - This overview document

### Documentation Features:
- Complete endpoint descriptions
- Request/response examples
- Error handling information
- Authentication requirements
- Testing instructions

## 🎯 Next Steps

### Immediate:
1. ✅ Admin Events API (Complete)
2. ✅ Public Events API (Complete)
3. ✅ Event Registration API (Complete)
4. ⏳ Event Reviews API (Next)
5. ⏳ Payment Integration (Next)

### Future:
1. ⏳ Event Notifications API
2. ⏳ Event Analytics API
3. ⏳ Mobile App APIs
4. ⏳ Third-party Integrations

## 🔗 Related Files

### API Routes:
- `adminEventsRoutes.js` - Admin events management
- `publicEventsRoutes.js` - Public events access
- `eventRegistrationRoutes.js` - Event registration
- `forumRoutes.js` - Forum management
- `chatRoutes.js` - Chat functionality

### Models:
- `models.js` - Database models
- Event schema
- Registration schema

### Documentation:
- `ADMIN_EVENTS_API.md` - Admin API docs
- `TESTING_GUIDE.md` - Testing instructions
- `API_OVERVIEW.md` - This overview

---

**Total APIs**: 3 new + 3 existing = 6 APIs
**Status**: ✅ Ready for testing and deployment 