const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  deviceId: { type: String, required: true },
  lat: { type: Number, required: true },
  lon: { type: Number, required: true },
  timestamp: Number,
  ipCity: String,
  gpsCity: String,
  fraudFlag: String,
  riskScore: Number,
});

module.exports = mongoose.model("LocationLog", schema);
