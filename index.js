// main file ! 

require('dotenv').config(); //. This is critical for following the India DPDP Act 2023 and RBI guidelines

//inventory of required modules
const express = require('express');
const mongoose = require('mongoose');
const LocationLog = require('./models/locationLogs');
const cityMapper = require('./utils/cityMapper.js');


//haversine formuls to calculate distance between two locations
const haversineDistance = require("./utils/haversine");
const { isFar, isImpossibleJump } = require("./utils/fraud");





//initialize express app
const app = express();
app.use(express.json());

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

//start server
app.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on port ${process.env.PORT || 3000}`);

});
