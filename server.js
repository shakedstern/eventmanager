import express from "express";
import mongoose from "mongoose";
import Joi from "joi";

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

// Joi validation schemas
const eventValidationSchema = Joi.object({
  title: Joi.string().required().messages({ "string.empty": "Title is required" }),
  description: Joi.string().max(500).messages({
    "string.max": "Description cannot exceed 500 characters",
  }),
  location: Joi.string().required().messages({ "string.empty": "Location is required" }),
  date: Joi.date().required().messages({ "date.base": "Date is invalid or missing" }),
  status: Joi.string().valid("active", "cancelled", "done").default("active"),
});

const querySchema = Joi.object({
  location: Joi.string().optional().min(3).max(50),
  date: Joi.date().optional(),
  status: Joi.string().optional().valid("pending", "completed", "cancelled"),
}).or("location", "date", "status");

// Middleware
const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).send({
      message: "Validation error",
      details: error.details.map((detail) => detail.message),
    });
  }
  next();
};

const validateQuery = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.query, { abortEarly: false });
  if (error) {
    return res.status(400).send({
      message: "Validation error",
      details: error.details.map((detail) => detail.message),
    });
  }
  next();
};

// Routes
app.post("/events", validate(eventValidationSchema), async (req, res) => {
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

app.get("/events", validateQuery(querySchema), async (req, res) => {
  try {
    const query = {};
    if (req.query.location) query.location = req.query.location;
    if (req.query.date) query.date = new Date(req.query.date);
    if (req.query.status) query.status = req.query.status;

    const events = await Event.find(query);
    res.send(events);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Error fetching events" });
  }
});

// Other routes remain unchanged

// Start the server
const port = 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
