const mongoose = require('mongoose');
const EventSchema = new mongoose.Schema({
    title: String,
    description: String,
    location: String,
    date: Date,
    status: String,
  });
const Event = mongoose.model("Event", EventSchema);
module.exports = Event