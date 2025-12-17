const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please provide event title'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Please provide event description']
  },
  date: {
    type: Date,
    required: [true, 'Please provide event date']
  },
  time: {
    type: String,
    required: [true, 'Please provide event time']
  },
  location: {
    type: String,
    required: [true, 'Please provide event location']
  },
  capacity: {
    type: Number,
    required: [true, 'Please provide event capacity'],
    min: 1
  },
  currentAttendees: {
    type: Number,
    default: 0
  },
  imageUrl: {
    type: String,
    required: [true, 'Please upload event image']
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  attendees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

EventSchema.index({ date: 1, creator: 1 });

module.exports = mongoose.model('Event', EventSchema);