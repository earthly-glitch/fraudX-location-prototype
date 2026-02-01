// main file ! 
const cors = require('cors');
require('dotenv').config(); //. This is critical for following the India DPDP Act 2023 and RBI guidelines

//inventory of required modules
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const LocationLog = require('./models/locationLogs');
const cityMapper = require('./utils/cityMapper.js');


//haversine formuls to calculate distance between two locations
const haversineDistance = require("./utils/haversine");
const { isFar, isImpossibleJump } = require("./utils/fraud.js");
const { getLastPing, saveLastPing } = require('./utils/redisHelper');




//initialize express app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",  // Allow all origins for now (restrict in production)
    methods: ["GET", "POST"]
  }
});

app.use(cors());  // Enable CORS for all routes
app.use(express.json());
// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(' Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log(' Client disconnected:', socket.id);
  });
});

// mongoDB connection
mongoose.connect("mongodb://127.0.0.1:27017/starksLocProto")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log("Mongo Error:", err));

//route testing
app.get('/location', (req, res) => {
    console.log("Root startpoint hit");
    res.send('Location Logging Service is up and running!');
});

//sarthak code
// app.post("/api/location/ping", (req, res) => {
//   const {
//     userCoords,
//     deliveryCoords,
//     prevCoords,
//     prevTime,
//     timestamp
//   } = req.body;

//   console.log("Incoming Ping:", req.body);

//   let fraud = null;
//   let riskScore = 0;

//   // Distance mismatch check
//   if (isFar(deliveryCoords, userCoords)) {
//     fraud = "GeoMismatch";
//     riskScore = 0.8;
//   }

//   // Impossible movement check
//   if (
//     prevCoords &&
//     prevTime &&
//     isImpossibleJump(prevCoords, prevTime, userCoords, timestamp)
//   ) {
//     fraud = "ImpossibleJump";
//     riskScore = 0.9;
//     speed = isImpossibleJump(prevCoords, prevTime, userCoords, timestamp).speed;
//   }

//   console.log("Fraud:", fraud);
//   console.log("Risk Score:", riskScore);

//   res.json({
//     ok: true,
//     fraud,
//     riskScore,
//     speed
//   });
// });
app.post("/api/location/ping", async (req, res) => {
  const {
    deviceId,
    userCoords,
    deliveryCoords,
    timestamp
  } = req.body;

  if (!deviceId) {
    return res.status(400).json({ 
      ok: false, 
      error: "deviceId is required" 
    });
  }

  if (!userCoords || !timestamp) {
    return res.status(400).json({ 
      ok: false, 
      error: "userCoords and timestamp are required" 
    });
  }

  console.log("Incoming Ping:", req.body);

  let fraudTypes = [];  // ✅ NOW AN ARRAY
  let riskScore = 0;
  let speed = null;

  const lastPing = await getLastPing(deviceId);
  console.log("Last ping from Redis:", lastPing);

  // ✅ Distance fraud check (GeoMismatch)
  if (deliveryCoords) {
    const distanceCheck = isFar(deliveryCoords, userCoords);
    if (distanceCheck.flag) {
      fraudTypes.push("GeoMismatch");
      riskScore = Math.max(riskScore, 0.8);  // Keep highest risk score
      console.log(`GeoMismatch detected: ${distanceCheck.distance} km from delivery point`);
    }
  }

  // ✅ Speed fraud check (ImpossibleJump)
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
      riskScore = Math.max(riskScore, 0.9);  // Keep highest risk score
    }

    console.log(`Speed check: ${speed} km/h`);
  } else {
    console.log("No previous ping - skipping speed check");
  }

  // ✅ SAVE CURRENT PING TO REDIS
  await saveLastPing(deviceId, {
    lat: userCoords.lat,
    lon: userCoords.lon,
    timestamp: timestamp
  });

  // Save to MongoDB for history
  await LocationLog.create({
    deviceId,
    lat: userCoords.lat,
    lon: userCoords.lon,
    timestamp,
    fraudFlag: fraudTypes.length > 0 ? fraudTypes.join(", ") : null,  // Store as comma-separated string
    riskScore
  });

 console.log("Fraud Types:", fraudTypes);
console.log("Risk Score:", riskScore);

// ✅ EMIT SOCKET.IO EVENTS FOR REAL-TIME UPDATES
// Event 1: Location update (always emit)
io.emit('location_update', {
  deviceId,
  lat: userCoords.lat,
  lon: userCoords.lon,
  fraudTypes: fraudTypes.length > 0 ? fraudTypes : null,
  riskScore,
  speed,
  timestamp
});

// Event 2: Fraud alert (only if fraud detected)
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


app.get("/api/location/test-distance", (req, res) => {
  const coord1 = { lat: 12.9716, lon: 77.5946 }; // example coordinates 
  const coord2 = { lat: 12.2958, lon: 76.6394 };

  const distance = haversineDistance(coord1, coord2);

  console.log("Test Distance:", distance);

  res.json({ distance });
});



// Read logs API
app.get("/api/location/logs", async (req, res) => {
  const logs = await LocationLog.find();
  res.json(logs);
});


//Use: stores the real delivery location to compare fraud pings later.
app.post("/api/location/set-delivery", async (req, res) => {
const {deviceId,Lat,Lon,city} = req.body;

const saveData = await LocationLog.create({ // new log entry
  deviceId: deviceId,
  lat: Lat,
  lon: Lon,
  gpsCity: city,  
  fraudFlag: "DeliveryPoint",
  timestamp: Date.now(),
});

 console.log("Delivery point saved:", saveData);
  res.json({ ok: true, storedID: saveData._id });
});





// route to check fraud based on city mapping
app.post("/api/location/check-fraud",async (req,res)=>{

  try{

  const{deviceId,lat,lon,ipCity} = req.body;

  //safety checks for required fields
if(!deviceId||!lat||!lon||!ipCity){
  return res.status(400).json({ok:false,error:"Missing required fields"});
}

  const gpsCity = cityMapper(lat,lon);

  const regionFraud = ipCity!==gpsCity;

  const delivery = await LocationLog.findOne({deviceId:deviceId,fraudFlag:"DeliveryPoint"}).sort({_id:-1});

  let geoFraud = false;
  let distance = null;

  if(delivery){
  distance = haversineDistance(
  { lat, lon },
  { lat: delivery.lat, lon: delivery.lon }
);

    geoFraud = distance > 0.5; // 1km threshold
  }

  console.log("Mapped GPS city:", gpsCity);
  console.log("Region mismatch fraud:", regionFraud);
  console.log("Delivery distance:", distance, "km");
  console.log("Geo fraud:", geoFraud);

  res.json({
    ok: true,
    gpsCity,
    regionFraud,
    geoFraud,
    distance
  });

  }catch(err){
    console.log("Error in fraud check:", err);
    res.status(500).json({ok:false,error:"Internal Server Error"});
  }
});


//GET endpoint to fetch delivery location for a device
app.get("/api/location/delivery/:deviceId",async(req,res)=>{
 const log = await LocationLog.findOne({deviceId:req.params.deviceId, fraudFlag:"DeliveryPoint"});
  res.json(log);
});

// Serve the Socket.IO test page
app.get('/test', (req, res) => {
  console.log("TEST ROUTE HIT!");
  res.send("Hello from test route!");
});

//start server
server.listen(process.env.PORT || 3000, () => {
    console.log(`Server running on port ${process.env.PORT || 3000}`);
    console.log(`✅ Socket.IO ready for real-time updates`);
});



