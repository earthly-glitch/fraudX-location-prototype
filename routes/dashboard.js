const express = require('express');
const router = express.Router();

// Main dashboard with Leaflet map
router.get('/dashboard', (req, res) => {
  res.render('dashboard', { 
    title: 'FraudX - Live Dashboard',
    apiUrl: process.env.API_BASE_URL || 'http://localhost:3000'
  });
});

// Simulator control panel
router.get('/simulator', (req, res) => {
  res.render('simulator', {
    title: 'FraudX - Simulation Control',
    apiUrl: process.env.API_BASE_URL || 'http://localhost:3000'
  });
});

// Redirect root to dashboard
router.get('/', (req, res) => {
  res.redirect('/dashboard');
});

module.exports = router;