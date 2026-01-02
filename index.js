// main file ! 

require('dotenv').config(); //. This is critical for following the India DPDP Act 2023 and RBI guidelines

//inventory of required modules
const express = require('express');
const mongoose = require('mongoose');
const LocationLog = require('./models/locationLogs');

//initialize express app
const app = express();
app.use(express.json());

//mongoDB connection
mongoose.connect("mongodb://127.0.0.1:27017/starksLocProto")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log("Mongo Error:", err));

//route testing
app.get('/location', (req, res) => {
    console.log("Root startpoint hit");
    res.send('Location Logging Service is up and running!');
});


//insert location log using post request
app.post("/api/location/ping", async (req, res) => {
  try {
    const logEntry = await LocationLog.create(req.body);
    console.log("Inserted Log ID:", logEntry._id);
    res.json({ ok: true, storedID: logEntry._id });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});


// Read logs API
app.get("/api/location/logs", async (req, res) => {
  const logs = await LocationLog.find();
  res.json(logs);
});

app.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on port ${process.env.PORT || 3000}`);

});
