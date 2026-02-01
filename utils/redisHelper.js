const redisClient = require('./redisClient');

/**
 * Get last ping data for a device from Redis
 */
async function getLastPing(deviceId) {
  try {
    const key = `device:${deviceId}`;
    const data = await redisClient.get(key);
    
    if (!data) {
      console.log(`No previous ping found for device: ${deviceId}`);
      return null;
    }
    
    return JSON.parse(data);
  } catch (err) {
    console.error('Error getting last ping from Redis:', err);
    return null;
  }
}

/**
 * Save current ping data to Redis
 */
async function saveLastPing(deviceId, pingData) {
  try {
    const key = `device:${deviceId}`;
    const value = JSON.stringify({
      lat: pingData.lat,
      lon: pingData.lon,
      timestamp: pingData.timestamp
    });
    
    // Save to Redis with 24-hour expiration
    await redisClient.setEx(key, 86400, value);
    console.log(`✅ Saved ping for device: ${deviceId}`);
    return true;
  } catch (err) {
    console.error('Error saving ping to Redis:', err);
    return false;
  }
}

/**
 * Delete device data from Redis
 */
async function deleteDeviceData(deviceId) {
  try {
    const key = `device:${deviceId}`;
    await redisClient.del(key);
    console.log(`Deleted Redis data for device: ${deviceId}`);
    return true;
  } catch (err) {
    console.error('Error deleting device data:', err);
    return false;
  }
}

module.exports = {
  getLastPing,
  saveLastPing,
  deleteDeviceData
};