const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const Event = require('../models/Event');
const { protect } = require("../Middleware/authMiddleware");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });
router.get('/', async (req, res) => {
  try {
    const { search, date } = req.query;
    let query = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }
    if (date) {
      const searchDate = new Date(date);
      const nextDay = new Date(searchDate);
      nextDay.setDate(nextDay.getDate() + 1);
      query.date = { $gte: searchDate, $lt: nextDay };
    }
    const events = await Event.find(query)
      .populate('creator', 'name email')
      .sort({ date: 1 });
    res.json({
      success: true,
      count: events.length,
      events
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('creator', 'name email')
      .populate('attendees', 'name email');
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    res.json({
      success: true,
      event
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
router.post('/', protect, upload.single('image'), async (req, res) => {
  try {
    const { title, description, date, time, location, capacity } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image'
      });
    }
    const existingEvent = await Event.findOne({
      title: { $regex: `^${title}$`, $options: 'i' }
    });

    if (existingEvent) {
      return res.status(409).json({
        success: false,
        message: 'An event with this title already exists'
      });
    }
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'events' },
      async (error, result) => {
        if (error) {
          return res.status(500).json({
            success: false,
            message: 'Image upload failed'
          });
        }
        const event = await Event.create({
          title,
          description,
          date,
          time,
          location,
          capacity: parseInt(capacity),
          imageUrl: result.secure_url,
          creator: req.user._id
        });
        const populatedEvent = await Event.findById(event._id)
          .populate('creator', 'name email');
        res.status(201).json({
          success: true,
          event: populatedEvent
        });
      }
    );
    uploadStream.end(req.file.buffer);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
router.put('/:id', protect, upload.single('image'), async (req, res) => {
  try {
    let event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    if (event.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this event'
      });
    }
    const updateData = { ...req.body };
    if (
      updateData.capacity &&
      Number(updateData.capacity) < event.attendees.length
    ) {
      const allowedCount = Number(updateData.capacity);

      event.attendees = event.attendees.slice(0, allowedCount);
      event.currentAttendees = allowedCount;

      updateData.attendees = event.attendees;
      updateData.currentAttendees = allowedCount;
    }
    if (req.file) {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'events' },
        async (error, result) => {
          if (error) {
            return res.status(500).json({
              success: false,
              message: 'Image upload failed'
            });
          }
          updateData.imageUrl = result.secure_url;
          event = await Event.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
          ).populate('creator', 'name email');
          res.json({
            success: true,
            event
          });
        }
      );
      uploadStream.end(req.file.buffer);
    } else {
      event = await Event.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      ).populate('creator', 'name email');

      res.json({
        success: true,
        event
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
router.delete('/:id', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    if (event.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this event'
      });
    }
    await event.deleteOne();
    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
router.get('/user/my-events', protect, async (req, res) => {
  try {
    const events = await Event.find({ creator: req.user._id })
      .populate('creator', 'name email')
      .sort({ date: 1 });
    res.json({
      success: true,
      count: events.length,
      events
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
router.get('/user/attending', protect, async (req, res) => {
  try {
    const events = await Event.find({ attendees: req.user._id })
      .populate('creator', 'name email')
      .sort({ date: 1 });
    res.json({
      success: true,
      count: events.length,
      events
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
module.exports = router;