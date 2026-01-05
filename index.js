// main file ! 

require('dotenv').config(); //. This is critical for following the India DPDP Act 2023 and RBI guidelines

//inventory of required modules
const express = require('express');
const mongoose = require('mongoose');
const LocationLog = require('./models/locationLogs');


//haversine formuls to calculate distance between two locations
const haversineDistance = require("./utils/haversine");
const { isFar, isImpossibleJump } = require("./utils/fraud");




//initialize express app
const app = express();
app.use(express.json());

//mongoDB connection
// mongoose.connect("mongodb://127.0.0.1:27017/starksLocProto")
//   .then(() => console.log("MongoDB connected"))
//   .catch(err => console.log("Mongo Error:", err));

//route testing
app.get('/location', (req, res) => {
    console.log("Root startpoint hit");
    res.send('Location Logging Service is up and running!');
});

//sarthak code
app.post("/api/location/ping", (req, res) => {
  const {
    userCoords,
    deliveryCoords,
    prevCoords,
    prevTime,
    timestamp
  } = req.body;

  console.log("Incoming Ping:", req.body);

  let fraud = null;
  let riskScore = 0;

  // Distance mismatch check
  if (isFar(deliveryCoords, userCoords)) {
    fraud = "GeoMismatch";
    riskScore = 0.8;
  }

  // Impossible movement check
  if (
    prevCoords &&
    prevTime &&
    isImpossibleJump(prevCoords, prevTime, userCoords, timestamp)
  ) {
    fraud = "ImpossibleJump";
    riskScore = 0.9;
  }

  console.log("Fraud:", fraud);
  console.log("Risk Score:", riskScore);

  res.json({
    ok: true,
    fraud,
    riskScore
  });
});


app.get("/api/location/test-distance", (req, res) => {
  const coord1 = { lat: 12.9716, lng: 77.5946 };
  const coord2 = { lat: 12.2958, lng: 76.6394 };

  const distance = haversineDistance(coord1, coord2);

  console.log("Test Distance:", distance);

  res.json({ distance });
});



// Read logs API
app.get("/api/location/logs", async (req, res) => {
  const logs = await LocationLog.find();
  res.json(logs);
});

app.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on port ${process.env.PORT || 3000}`);

});
