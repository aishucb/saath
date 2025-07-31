/**
 * Database Models for Saath Platform
 * 
 * This file defines all MongoDB schemas and models used throughout the application.
 * Each model represents a different entity in the system with proper validation
 * and relationships.
 * 
 * Models included:
 * - Customer: User accounts and profiles
 * - Admin: Administrative users
 * - Forum: Community discussion posts
 * - Comment: Forum comments and replies
 * - Message: Real-time chat messages
 * - Event: Event management and details
 * 
 * @author Saath Team
 * @version 1.0.0
 */

const mongoose = require('mongoose');

// ============================================================================
// CUSTOMER MODEL
// ============================================================================

/**
 * Customer Schema
 * 
 * Represents user accounts in the platform. Customers can follow each other,
 * participate in forums, register for events, and use chat features.
 * 
 * @field name - Display name of the customer
 * @field phone - Unique phone number (primary identifier)
 * @field email - Email address (optional)
 * @field picture - Profile picture URL
 * @field createdAt - Account creation timestamp
 * @field updatedAt - Last update timestamp
 * @field follower - Array of customers this user follows
 * @field followed - Array of customers following this user
 */
const customerSchema = new mongoose.Schema({
  name: { type: String },
  phone: { type: String, unique: true },
  email: { type: String },
  picture: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  follower: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }],
  followed: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }]
});

// ============================================================================
// ADMIN MODEL
// ============================================================================

/**
 * Admin Schema
 * 
 * Represents administrative users who can manage events, forums, and platform content.
 * Admins have elevated privileges and can create, edit, and delete content.
 * 
 * @field name - Admin display name
 * @field email - Unique email address
 * @field password - Hashed password for authentication
 * @field role - User role (defaults to 'admin')
 * @field createdAt - Account creation timestamp
 * @field updatedAt - Last update timestamp
 */
const adminSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, unique: true },
  password: { type: String },
  role: { type: String, default: 'admin' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

/**
 * Admin Password Comparison Method
 * 
 * Compares a candidate password with the stored hashed password.
 * 
 * @param {string} candidatePassword - Password to verify
 * @returns {Promise<boolean>} True if passwords match, false otherwise
 */
adminSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// ============================================================================
// FORUM MODEL
// ============================================================================

/**
 * Forum Schema
 * 
 * Represents community discussion posts created by admins.
 * Forums can have tags for categorization and are the parent for comments.
 * 
 * @field title - Post title
 * @field body - Post content
 * @field tags - Array of tags for categorization
 * @field createdBy - Reference to admin who created the post
 * @field createdAt - Post creation timestamp
 */
const forumSchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String, required: true },
  tags: { type: [String], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  createdAt: { type: Date, default: Date.now }
});

// ============================================================================
// COMMENT MODEL
// ============================================================================

/**
 * Comment Schema
 * 
 * Represents comments on forum posts. Comments can be nested (replies to other comments)
 * and are created by customers.
 * 
 * @field forumId - Reference to the forum post
 * @field addedTime - Comment creation timestamp
 * @field replyTo - Reference to parent comment (for nested replies)
 * @field content - Comment text content
 * @field userId - Reference to customer who created the comment
 */
const commentSchema = new mongoose.Schema({
  forumId: { type: mongoose.Schema.Types.ObjectId, ref: 'Forum', required: true },
  addedTime: { type: Date, default: Date.now },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
  content: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
});

// ============================================================================
// MESSAGE MODEL
// ============================================================================

/**
 * Message Schema
 * 
 * Represents real-time chat messages between customers.
 * Messages can be replies to other messages and are stored for persistence.
 * 
 * @field sender - Reference to customer who sent the message
 * @field recipient - Reference to customer who receives the message
 * @field content - Message text content
 * @field replyTo - Reference to message being replied to
 * @field timestamp - Message creation timestamp
 */
const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  content: { type: String, required: true },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  timestamp: { type: Date, default: Date.now }
});

// ============================================================================
// EVENT MODEL
// ============================================================================

/**
 * Event Schema
 * 
 * Represents events that customers can register for. Events have complex pricing
 * structures, discount options, and status management.
 * 
 * @field eventName - Name of the event
 * @field date - Event date
 * @field eventTime - Start and end times
 * @field place - Event location
 * @field tags - Array of tags for categorization
 * @field image - Event image URL
 * @field pricing - Array of pricing tiers with different options
 * @field discountOptions - Group discount configurations
 * @field organizer - Event organizer name
 * @field description - Detailed event description
 * @field duration - Event duration
 * @field maxAttendees - Maximum number of attendees
 * @field availableSlots - Current available slots
 * @field status - Event status (draft/published/cancelled/completed)
 * @field createdBy - Reference to admin who created the event
 * @field attendees - Array of registered customers
 * @field createdAt - Event creation timestamp
 * @field updatedAt - Last update timestamp
 */
const eventSchema = new mongoose.Schema({
  eventName: { 
    type: String, 
    required: true,
    trim: true
  },
  date: { 
    type: Date, 
    required: true
  },
  eventTime: {
    from: { 
      type: String, 
      required: true 
    },
    to: { 
      type: String, 
      required: true 
    }
  },
  place: { 
    type: String, 
    required: true,
    trim: true
  },
  tags: [{ 
    type: String, 
    trim: true 
  }],
  image: { 
    type: String 
  },
  pricing: [{
    name: { 
      type: String, 
      required: true,
      trim: true
    },
    description: { 
      type: String, 
      trim: true
    },
    price: { 
      type: Number, 
      required: true,
      min: 0
    },
    tags: [{ 
      type: String, 
      trim: true 
    }],
    slotsAvailable: { 
      type: Number, 
      required: true,
      min: 1
    }
  }],
  discountOptions: [{
    name: { 
      type: String, 
      required: true,
      trim: true
    },
    totalMembersNeeded: { 
      type: Number, 
      required: true,
      min: 2
    },
    percentageDiscount: { 
      type: Number, 
      required: true,
      min: 1,
      max: 100
    }
  }],
  organizer: { 
    type: String, 
    required: true,
    trim: true
  },
  description: { 
    type: String, 
    required: true,
    trim: true
  },
  duration: { 
    type: String, 
    required: true,
    trim: true
  },
  maxAttendees: { 
    type: Number, 
    required: true,
    min: 1
  },
  availableSlots: { 
    type: Number, 
    required: true,
    min: 1
  },
  status: { 
    type: String, 
    enum: ['draft', 'published', 'cancelled', 'completed'],
    default: 'draft'
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Admin', 
    required: true 
  },
  attendees: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Customer' 
  }],
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

/**
 * Event Pre-save Middleware
 * 
 * Automatically updates the updatedAt timestamp whenever an event is saved.
 */
eventSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// ============================================================================
// MODEL CREATION AND EXPORT
// ============================================================================

// Create models with proper error handling for existing models
const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);
const Admin = mongoose.models.Admin || mongoose.model('Admin', adminSchema);
const Forum = mongoose.models.Forum || mongoose.model('Forum', forumSchema, 'Forum');
const Comment = mongoose.models.Comment || mongoose.model('Comment', commentSchema);
const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);
const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);

// Export all models
module.exports = {
  Customer,
  Admin,
  Forum,
  Comment,
  Message,
  Event
};
