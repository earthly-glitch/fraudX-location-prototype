const redis = require('redis');

const redisClient = redis.createClient({
  url: 'redis://localhost:6379'
});

redisClient.on('error', (err) => {
  console.error('❌ Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

// Connect immediately
(async () => {
  try {
    await redisClient.connect();
    console.log('✅ Redis client ready');
  } catch (err) {
    console.error('❌ Failed to connect to Redis:', err);
  }
})();

module.exports = redisClient;