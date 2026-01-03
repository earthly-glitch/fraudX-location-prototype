
const haversineDistance = require("./haversine");

// GPS mismatch > 0.5 km
const isFar = (deliveryCoords, userCoords) => {
  const distance = haversineDistance(deliveryCoords, userCoords);
  return distance > 0.5;
};

// Speed > 40 km/h inside city
const isImpossibleJump = (prevCoords, prevTime, newCoords, newTime) => {
  const distance = haversineDistance(prevCoords, newCoords); // km
  const timeDiff = (newTime - prevTime) / (1000 * 60 * 60); // hours

  if (timeDiff === 0) return true;

  const speed = distance / timeDiff;
  return speed > 40;
};

module.exports = {
  isFar,
  isImpossibleJump,
};
