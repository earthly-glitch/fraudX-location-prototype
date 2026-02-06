const cityDatabase = {
  pune: { lat: 18.5204, lon: 73.8567, radius: 0.5 },
  mumbai: { lat: 19.0760, lon: 72.8777, radius: 0.5 },
  delhi: { lat: 28.7041, lon: 77.1025, radius: 0.5 },
  bangalore: { lat: 12.9716, lon: 77.5946, radius: 0.5 },
  kolkata: { lat: 22.5726, lon: 88.3639, radius: 0.5 },
  chennai: { lat: 13.0827, lon: 80.2707, radius: 0.5 },
  hyderabad: { lat: 17.3850, lon: 78.4867, radius: 0.5 },
  ahmedabad: { lat: 23.0225, lon: 72.5714, radius: 0.5 }
};

function simpleDistance(lat1, lon1, lat2, lon2) {
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

function cityMapper(lat, lon) {
  let nearestCity = 'Unknown';
  let minDistance = Infinity;

  for (const [cityName, cityData] of Object.entries(cityDatabase)) {
    const distance = simpleDistance(lat, lon, cityData.lat, cityData.lon);
    
    if (distance < cityData.radius && distance < minDistance) {
      minDistance = distance;
      nearestCity = cityName.charAt(0).toUpperCase() + cityName.slice(1);
    }
  }

  return nearestCity;
}

module.exports = cityMapper;