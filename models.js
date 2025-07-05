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

// Create models
const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);
const Admin = mongoose.models.Admin || mongoose.model('Admin', adminSchema);
const Forum = mongoose.models.Forum || mongoose.model('Forum', forumSchema, 'Forum');
const Comment = mongoose.models.Comment || mongoose.model('Comment', commentSchema);

module.exports = {
  Customer,
  Admin,
  Forum,
  Comment
};
