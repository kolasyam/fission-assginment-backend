const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Event = require('../models/Event');
const { protect } = require("../Middleware/authMiddleware");

router.post('/:eventId', protect, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const eventId = req.params.eventId;
    const userId = req.user._id;
    const event = await Event.findById(eventId).session(session);
    if (!event) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    if (event.attendees.includes(userId)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'You have already RSVP\'d to this event'
      });
    }
    if (event.currentAttendees >= event.capacity) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Event is at full capacity'
      });
    }
    const updatedEvent = await Event.findOneAndUpdate(
      {
        _id: eventId,
        currentAttendees: { $lt: event.capacity }, // Double-check capacity
        attendees: { $ne: userId } // Ensure user not already in array
      },
      {
        $push: { attendees: userId },
        $inc: { currentAttendees: 1 }
      },
      {
        new: true,
        session
      }
    ).populate('creator', 'name email');
    if (!updatedEvent) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Unable to RSVP. Event may be full or you may have already RSVP\'d'
      });
    }
    await session.commitTransaction();
    session.endSession();
    res.json({
      success: true,
      message: 'Successfully RSVP\'d to event',
      event: updatedEvent
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
router.delete('/:eventId', protect, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const eventId = req.params.eventId;
    const userId = req.user._id;
    const event = await Event.findById(eventId).session(session);
    if (!event) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    if (!event.attendees.includes(userId)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'You have not RSVP\'d to this event'
      });
    }
    const updatedEvent = await Event.findOneAndUpdate(
      {
        _id: eventId,
        attendees: userId
      },
      {
        $pull: { attendees: userId },
        $inc: { currentAttendees: -1 }
      },
      {
        new: true,
        session
      }
    ).populate('creator', 'name email');
    await session.commitTransaction();
    session.endSession();
    res.json({
      success: true,
      message: 'Successfully cancelled RSVP',
      event: updatedEvent
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
module.exports = router;