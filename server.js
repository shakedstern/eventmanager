import express from "express";
import mongoose from "mongoose";
import Joi from "joi";
import { schema } from "./models";

const app = express();
app.use(express.json());

// MongoDB connection
mongoose.connect("mongodb://localhost:27017/eventsapp");

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => console.log("Connected to MongoDB"));

// Define Event model
const EventSchema = new mongoose.Schema({
  title: String,
  description: String,
  location: String,
  date: Date,
  status: String,
});
const Event = mongoose.model("Event", EventSchema);


//validation
// Joi validation schema for an event
const eventValidationSchema = Joi.object({
  title: Joi.string().required().messages({
    "string.empty": "Title is required",
  }),
  description: Joi.string().max(500).messages({
    "string.max": "Description cannot exceed 500 characters",
  }),
  location: Joi.string().required().messages({
    "string.empty": "Location is required",
  }),
  date: Joi.date().required().messages({
    "date.base": "Date is invalid or missing",
  }),
  status: Joi.string().valid("active","cancale" ,"done").default("active"),
});

const validateEvent = (req, res,schema, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).send({
        message: "Validation error",
        details: error.details.map((detail) => detail.message),
      });
    }
    next();
  };
  
// Routes

// Create an event
app.post("/events",validateEvent(schema=eventValidationSchema), async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const event = new Event(req.body);
    const savedEvent = await event.save({ session });
    await session.commitTransaction();
    res.send(savedEvent);
  } catch (err) {
    await session.abortTransaction();
    console.error(err);
    res.status(500).send({ message: "Error saving event" });
  } finally {
    session.endSession();
  }
});

// Define Joi Schema for Query Parameters
const querySchema = Joi.object({
    location: Joi.string().optional().min(3).max(50),
    date: Joi.date().optional(),
    status: Joi.string().optional().valid("pending", "completed", "cancelled"),
  }).or("location", "date", "status"); // At least one of these must be provided

// Get all events
app.get("/events", validateEvent(schema=querySchema),async (req, res) => {
    try {
      // Check if the query object is empty
      if (Object.keys(req.query).length > 0) {
        const { location, date, status } = req.query;
  
        // Validate the filter parameters
        if ((!location || !date || !status)) {
          return res.status(400).send({ message: "Error: Invalid filter combination" });
        }
      }
  
      // Construct the query dynamically
      const query = {};
      if (req.query.location) query.location = req.query.location;
      if (req.query.date) query.date = new Date(req.query.date); // Convert date to Date object
      if (req.query.status) query.status = req.query.status;
  
      // Fetch events
      const events = await Event.find(query);
      res.send(events);
    } catch (err) {
      console.error(err);
      res.status(500).send({ message: "Error fetching events" });
    }
  });


// Update an event
app.put("/events/:id", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      session,
    });
    await session.commitTransaction();
    if (event) res.send(event);
    if(!event) res.status(400).send({ message: "Error found event with this id" });
  } catch (err) {
    await session.abortTransaction();
    console.error(err);
    res.status(500).send({ message: "Error updating event" });
  } finally {
    session.endSession();
  }
});

// Delete an event
app.delete("/events/:id", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const deletedEvent = await Event.findByIdAndDelete(req.params.id, { session });
    if (!deletedEvent) return res.status(404).send({ message: "Event not found" });
    await session.commitTransaction();
    res.send({ message: "Event deleted successfully" });
  } catch (err) {
    await session.abortTransaction();
    console.error(err);
    res.status(500).send({ message: "Error deleting event" });
  } finally {
    session.endSession();
  }
});

// Start the server
const port = 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
