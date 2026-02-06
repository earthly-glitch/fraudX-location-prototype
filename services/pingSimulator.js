const axios = require('axios');
const EventEmitter = require('events');

class PingSimulator extends EventEmitter {
  constructor() {
    super();
    this.activeSimulations = new Map();
    this.baseURL = process.env.API_BASE_URL || 'http://localhost:3000';
  }

  getRoutes() {
    return {
      normal: [
        { name: "Shivajinagar Start", lat: 18.5204, lon: 73.8567 },
        { name: "FC Road", lat: 18.5218, lon: 73.8577 },
        { name: "JM Road", lat: 18.5232, lon: 73.8587 },
        { name: "Deccan", lat: 18.5246, lon: 73.8597 },
        { name: "Prabhat Road", lat: 18.5260, lon: 73.8607 },
        { name: "Law College Road", lat: 18.5274, lon: 73.8617 },
        { name: "Senapati Bapat", lat: 18.5288, lon: 73.8627 },
        { name: "SB Road", lat: 18.5302, lon: 73.8637 },
        { name: "University Circle", lat: 18.5316, lon: 73.8647 },
        { name: "Pashan", lat: 18.5330, lon: 73.8657 }
      ],
      fast: [
        { name: "Pune Start", lat: 18.5204, lon: 73.8567 },
        { name: "Kothrud", lat: 18.5304, lon: 73.8667 },
        { name: "Warje", lat: 18.5404, lon: 73.8767 },
        { name: "Bavdhan", lat: 18.5504, lon: 73.8867 },
        { name: "Hinjewadi", lat: 18.5604, lon: 73.8967 },
        { name: "Mumbai Outskirts", lat: 18.6204, lon: 73.9567 }
      ],
      teleport: [
        { name: "Pune", lat: 18.5204, lon: 73.8567 },
        { name: "Mumbai", lat: 19.0760, lon: 72.8777 },
        { name: "Delhi", lat: 28.7041, lon: 77.1025 },
        { name: "Bangalore", lat: 12.9716, lon: 77.5946 },
        { name: "Kolkata", lat: 22.5726, lon: 88.3639 },
        { name: "Chennai", lat: 13.0827, lon: 80.2707 }
      ]
    };
  }

  startSimulation(deviceId, options = {}) {
    const { mode = 'normal', interval = 10 } = options;

    if (this.activeSimulations.has(deviceId)) {
      throw new Error(`Simulation already active for ${deviceId}`);
    }

    const routes = this.getRoutes();
    const selectedRoute = routes[mode];
    
    if (!selectedRoute) {
      throw new Error(`Invalid mode: ${mode}`);
    }

    const simulation = {
      deviceId,
      mode,
      interval: interval * 1000,
      route: selectedRoute,
      currentPosition: 0,
      pingCount: 0,
      totalDistance: 0,
      isRunning: true,
      intervalId: null,
      startTime: Date.now(),
      stats: {
        fraudsDetected: 0,
        lastFraudType: null,
        maxSpeed: 0
      }
    };

    simulation.intervalId = setInterval(() => {
      this._sendPing(simulation);
    }, simulation.interval);

    this.activeSimulations.set(deviceId, simulation);
    this._sendPing(simulation);

    this.emit('simulation-started', { 
      deviceId, 
      mode, 
      interval 
    });
    
    return simulation;
  }

  async _sendPing(simulation) {
    try {
      const location = simulation.route[simulation.currentPosition];
      const prevLocation = simulation.currentPosition > 0 
        ? simulation.route[simulation.currentPosition - 1] 
        : null;

      if (prevLocation) {
        const dist = this._calculateDistance(
          prevLocation.lat, prevLocation.lon,
          location.lat, location.lon
        );
        simulation.totalDistance += dist;
      }

      const payload = {
        deviceId: simulation.deviceId,
        userCoords: { lat: location.lat, lon: location.lon },
        timestamp: Date.now()
      };

      const response = await axios.post(
        `${this.baseURL}/api/location/ping`, 
        payload
      );

      simulation.pingCount++;
      const result = response.data;

      if (result.fraudTypes && result.fraudTypes.length > 0) {
        simulation.stats.fraudsDetected++;
        simulation.stats.lastFraudType = result.fraudTypes.join(', ');
      }
      if (result.speed && result.speed > simulation.stats.maxSpeed) {
        simulation.stats.maxSpeed = result.speed;
      }

      this.emit('ping-sent', {
        deviceId: simulation.deviceId,
        location,
        pingNumber: simulation.pingCount,
        result,
        stats: {
          totalDistance: simulation.totalDistance.toFixed(2),
          ...simulation.stats
        }
      });

      simulation.currentPosition++;
      if (simulation.currentPosition >= simulation.route.length) {
        simulation.currentPosition = 0;
        simulation.totalDistance = 0;
        this.emit('route-completed', { deviceId: simulation.deviceId });
      }

    } catch (error) {
      this.emit('ping-error', {
        deviceId: simulation.deviceId,
        error: error.message
      });
    }
  }

  stopSimulation(deviceId) {
    const simulation = this.activeSimulations.get(deviceId);
    if (!simulation) return false;

    clearInterval(simulation.intervalId);
    simulation.isRunning = false;
    this.activeSimulations.delete(deviceId);
    
    this.emit('simulation-stopped', { 
      deviceId, 
      totalPings: simulation.pingCount,
      duration: Date.now() - simulation.startTime
    });
    
    return true;
  }

  getSimulation(deviceId) {
    return this.activeSimulations.get(deviceId) || null;
  }

  getAllSimulations() {
    return Array.from(this.activeSimulations.values()).map(s => ({
      deviceId: s.deviceId,
      mode: s.mode,
      isRunning: s.isRunning,
      pingCount: s.pingCount,
      currentLocation: s.route[s.currentPosition],
      progress: `${s.currentPosition}/${s.route.length}`,
      stats: s.stats
    }));
  }

  stopAll() {
    const count = this.activeSimulations.size;
    this.activeSimulations.forEach((sim, deviceId) => {
      this.stopSimulation(deviceId);
    });
    return count;
  }

  _calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}

module.exports = new PingSimulator();