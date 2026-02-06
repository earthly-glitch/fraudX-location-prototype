const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  deviceId: { type: String, required: true, index: true },
  lat: { type: Number, required: true },
  lon: { type: Number, required: true },
  timestamp: { type: Number, required: true },
  ipCity: String,
  gpsCity: String,
  fraudFlag: String, // "DeliveryPoint" or "GeoMismatch, ImpossibleJump"
  riskScore: { type: Number, default: 0 }
}, {
  timestamps: true
});

schema.index({ deviceId: 1, timestamp: -1 });
schema.index({ fraudFlag: 1 });

module.exports = mongoose.model("LocationLog", schema);