console.log("ACTIVE FRAUD.JS LOADED!");

const haversineDistance = require("./haversine");

// Distance-based fraud check
const isFar = (deliveryCoords, userCoords) => {
  if (!deliveryCoords || !userCoords) {
    return { flag: false, distance: null };
  }

  const distance = haversineDistance(
    deliveryCoords,
    userCoords
  );

  return {
    flag: distance > 0.5,
    distance
  };
};

// Speed-based fraud check
const isImpossibleJump = (prevCoords, prevTime, newCoords, timestamp) => {
  if (!prevCoords || !newCoords || !prevTime || !timestamp) {
    return { flag: false, speed: null, distance: null };
  }

  const distance = haversineDistance(prevCoords, newCoords);
  
  const timeDiffHours = (timestamp - prevTime) / (1000 * 60 * 60);

  // If same timestamp or older timestamp, skip check (not fraud, just ignore)
  if (timeDiffHours <= 0) {
    return { flag: false, speed: 0, distance };
  }

  const speed = distance / timeDiffHours;
  const flag = speed > 100;

  console.log("Computed speed:", speed);

  return { flag, speed, distance };
};

module.exports = { isFar, isImpossibleJump };
