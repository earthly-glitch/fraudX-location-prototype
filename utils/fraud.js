const haversineDistance = require("./haversine");

const isFar = (deliveryCoords, userCoords) => {
  if (!deliveryCoords || !userCoords) {
    return { flag: false, distance: null };
  }

  const distance = haversineDistance(deliveryCoords, userCoords);

  return {
    flag: distance > 0.5, // 500m threshold
    distance
  };
};

const isImpossibleJump = (prevCoords, prevTime, newCoords, timestamp) => {
  if (!prevCoords || !newCoords || !prevTime || !timestamp) {
    return { flag: false, speed: null, distance: null };
  }

  const distance = haversineDistance(prevCoords, newCoords);
  const timeDiffHours = (timestamp - prevTime) / (1000 * 60 * 60);

  if (timeDiffHours <= 0) {
    return { flag: false, speed: 0, distance };
  }

  const speed = distance / timeDiffHours;
  const flag = speed > 100; // 100 km/h threshold

  return { flag, speed, distance };
};

module.exports = { 
  isFar, 
  isImpossibleJump 
};