const express = require('express');
const router = express.Router();
const LocationLog = require('../models/locationLogs');
const cityMapper = require('../utils/cityMapper');
const haversineDistance = require("../utils/haversine");
const { isFar, isImpossibleJump } = require("../utils/fraud");
const { getLastPing, saveLastPing } = require('../utils/redisHelper');

// GET /api/location - Health check
router.get('/', (req, res) => {
  res.send('Location Logging Service is up and running!');
});

// POST /api/location/ping - Main fraud detection endpoint
router.post("/ping", async (req, res) => {
  const {
    deviceId,
    userCoords,
    deliveryCoords,
    timestamp
  } = req.body;

  if (!deviceId) {
    return res.status(400).json({ ok: false, error: "deviceId is required" });
  }

  if (!userCoords || !timestamp) {
    return res.status(400).json({ ok: false, error: "userCoords and timestamp are required" });
  }

  console.log("Incoming Ping:", req.body);

  let fraudTypes = [];
  let riskScore = 0;
  let speed = null;

  const lastPing = await getLastPing(deviceId);
  console.log("Last ping from Redis:", lastPing);

  // Distance fraud check
  // Use provided deliveryCoords, or auto-lookup from last saved delivery point
  let effectiveDeliveryCoords = deliveryCoords;
  if (!effectiveDeliveryCoords) {
    const lastDelivery = await LocationLog.findOne({
      deviceId,
      fraudFlag: "DeliveryPoint"
    }).sort({ _id: -1 });

    if (lastDelivery) {
      effectiveDeliveryCoords = { lat: lastDelivery.lat, lon: lastDelivery.lon };
      console.log(`Auto-loaded delivery point for ${deviceId}: ${lastDelivery.lat}, ${lastDelivery.lon}`);
    }
  }

  if (effectiveDeliveryCoords) {
    const distanceCheck = isFar(effectiveDeliveryCoords, userCoords);
    if (distanceCheck.flag) {
      fraudTypes.push("GeoMismatch");
      riskScore = Math.max(riskScore, 0.8);
      console.log(`GeoMismatch detected: ${distanceCheck.distance} km from delivery point`);
    }
  }

  // Speed fraud check
  if (lastPing && lastPing.lat && lastPing.lon && lastPing.timestamp) {
    const jumpCheck = isImpossibleJump(
      { lat: lastPing.lat, lon: lastPing.lon },
      lastPing.timestamp,
      userCoords,
      timestamp
    );

    speed = jumpCheck.speed;

    if (jumpCheck.flag) {
      fraudTypes.push("ImpossibleJump");
      riskScore = Math.max(riskScore, 0.9);
    }

    console.log(`Speed check: ${speed} km/h`);
  } else {
    console.log("No previous ping - skipping speed check");
  }

  // Save to Redis
  await saveLastPing(deviceId, {
    lat: userCoords.lat,
    lon: userCoords.lon,
    timestamp: timestamp
  });

  // Save to MongoDB
  await LocationLog.create({
    deviceId,
    lat: userCoords.lat,
    lon: userCoords.lon,
    timestamp,
    fraudFlag: fraudTypes.length > 0 ? fraudTypes.join(", ") : null,
    riskScore
  });

  console.log("Fraud Types:", fraudTypes);
  console.log("Risk Score:", riskScore);

  // Socket.IO emits
  const io = req.app.get('io');

  io.emit('location_update', {
    deviceId,
    lat: userCoords.lat,
    lon: userCoords.lon,
    fraudTypes: fraudTypes.length > 0 ? fraudTypes : null,
    riskScore,
    speed,
    timestamp
  });

  if (fraudTypes.length > 0) {
    io.emit('fraud_alert', {
      deviceId,
      fraudTypes,
      riskScore,
      speed,
      lat: userCoords.lat,
      lon: userCoords.lon,
      timestamp
    });
  }

  res.json({
    ok: true,
    fraudTypes: fraudTypes.length > 0 ? fraudTypes : null,
    riskScore,
    speed,
    deviceId
  });
});

// GET /api/location/logs
router.get("/logs", async (req, res) => {
  const logs = await LocationLog.find().sort({ timestamp: -1 }).limit(100);
  res.json(logs);
});

// POST /api/location/set-delivery
router.post("/set-delivery", async (req, res) => {
  const { deviceId, Lat, Lon, city } = req.body;

  const saveData = await LocationLog.create({
    deviceId,
    lat: Lat,
    lon: Lon,
    gpsCity: city,
    fraudFlag: "DeliveryPoint",
    timestamp: Date.now()
  });

  console.log("Delivery point saved:", saveData);
  res.json({ ok: true, storedID: saveData._id });
});

// POST /api/location/check-fraud
router.post("/check-fraud", async (req, res) => {
  try {
    const { deviceId, lat, lon, ipCity } = req.body;

    if (!deviceId || !lat || !lon || !ipCity) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    const gpsCity = cityMapper(lat, lon);
    const regionFraud = ipCity !== gpsCity;

    const delivery = await LocationLog.findOne({
      deviceId: deviceId,
      fraudFlag: "DeliveryPoint"
    }).sort({ _id: -1 });

    let geoFraud = false;
    let distance = null;

    if (delivery) {
      distance = haversineDistance(
        { lat, lon },
        { lat: delivery.lat, lon: delivery.lon }
      );

      geoFraud = distance > 0.5;
    }

    console.log("Mapped GPS city:", gpsCity);
    console.log("Region mismatch:", regionFraud);
    console.log("Delivery distance:", distance, "km");
    console.log("Geo fraud:", geoFraud);

    res.json({
      ok: true,
      gpsCity,
      regionFraud,
      geoFraud,
      distance
    });

  } catch (err) {
    console.log("Error in fraud check:", err);
    res.status(500).json({ ok: false, error: "Internal Server Error" });
  }
});

// GET /api/location/delivery/:deviceId
router.get("/delivery/:deviceId", async (req, res) => {
  const log = await LocationLog.findOne({
    deviceId: req.params.deviceId,
    fraudFlag: "DeliveryPoint"
  });
  res.json(log);
});

module.exports = router;