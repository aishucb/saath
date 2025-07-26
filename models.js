const mongoose = require('mongoose');

// Customer Schema
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

// Admin Schema
const adminSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, unique: true },
  password: { type: String },
  role: { type: String, default: 'admin' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Method to compare password for admin
adminSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Forum Schema
const forumSchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String, required: true },
  tags: { type: [String], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  createdAt: { type: Date, default: Date.now }
});

// Comment Schema
const commentSchema = new mongoose.Schema({
  forumId: { type: mongoose.Schema.Types.ObjectId, ref: 'Forum', required: true },
  addedTime: { type: Date, default: Date.now },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
  content: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
});

// Message Schema
const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  content: { type: String, required: true },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  timestamp: { type: Date, default: Date.now }
});

// Event Schema
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

// Update timestamp on save
eventSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Create models
const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);
const Admin = mongoose.models.Admin || mongoose.model('Admin', adminSchema);
const Forum = mongoose.models.Forum || mongoose.model('Forum', forumSchema, 'Forum');
const Comment = mongoose.models.Comment || mongoose.model('Comment', commentSchema);
const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);
const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);

module.exports = {
  Customer,
  Admin,
  Forum,
  Comment,
  Message,
  Event
};
