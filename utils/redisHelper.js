const redis = require('redis');

const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379
  }
});

redisClient.on('connect', () => {
  console.log('✅ Redis client connected');
});

redisClient.on('error', (err) => {
  console.error('❌ Redis error:', err);
});

redisClient.on('ready', () => {
  console.log('✅ Redis client ready');
});

(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('Failed to connect to Redis:', err);
  }
})();

async function getLastPing(deviceId) {
  try {
    const key = `lastPing:${deviceId}`;
    const data = await redisClient.get(key);
    
    if (!data) {
      return null;
    }
    
    return JSON.parse(data);
  } catch (error) {
    console.error('Error getting last ping:', error);
    return null;
  }
}

async function saveLastPing(deviceId, pingData) {
  try {
    const key = `lastPing:${deviceId}`;
    await redisClient.set(key, JSON.stringify(pingData));
    await redisClient.expire(key, 86400); // 24 hours
  } catch (error) {
    console.error('Error saving last ping:', error);
  }
}

module.exports = {
  getLastPing,
  saveLastPing,
  redisClient
};