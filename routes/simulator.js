const express = require('express');
const router = express.Router();
const simulator = require('../services/pingSimulator');
const { body, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ ok: false, errors: errors.array() });
  }
  next();
};

// POST /api/simulator/start
router.post('/start', [
  body('deviceId').trim().notEmpty().withMessage('deviceId required'),
  body('mode').optional().isIn(['normal', 'fast', 'teleport']),
  body('interval').optional().isInt({ min: 5, max: 60 }),
  validate
], async (req, res) => {
  try {
    const {
      deviceId,
      mode = 'normal',
      interval = 10
    } = req.body;

    const sim = await simulator.startSimulation(deviceId, {
      mode,
      interval: parseInt(interval)
    });

    res.json({
      ok: true,
      message: `Simulation started for ${deviceId}`,
      simulation: {
        deviceId: sim.deviceId,
        mode: sim.mode,
        interval: sim.interval / 1000,
        routeLength: sim.route.length
      }
    });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// POST /api/simulator/stop
router.post('/stop', [
  body('deviceId').trim().notEmpty(),
  validate
], (req, res) => {
  const { deviceId } = req.body;
  const stopped = simulator.stopSimulation(deviceId);

  if (stopped) {
    res.json({ ok: true, message: `Simulation stopped for ${deviceId}` });
  } else {
    res.status(404).json({ ok: false, error: 'No active simulation found' });
  }
});

// GET /api/simulator/status
router.get('/status', (req, res) => {
  res.json({
    ok: true,
    activeSimulations: simulator.getAllSimulations(),
    count: simulator.activeSimulations?.size || 0
  });
});

// GET /api/simulator/status/:deviceId
router.get('/status/:deviceId', (req, res) => {
  const sim = simulator.getSimulation(req.params.deviceId);
  if (sim) {
    res.json({ ok: true, simulation: sim });
  } else {
    res.status(404).json({ ok: false, error: 'Simulation not found' });
  }
});

// POST /api/simulator/stop-all
router.post('/stop-all', (req, res) => {
  const count = simulator.stopAll();
  res.json({ ok: true, message: `Stopped ${count} simulations` });
});

module.exports = router;