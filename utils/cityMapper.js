const citites = require("../cities.json");


function mapCity(lat, lon) { // very basic mapping based on proximity
  for (let c of citites) {
    if (Math.abs(c.lat - lat) < 0.2 && Math.abs(c.lon - lon) < 0.2) { // within ~20km
      return c.city;
    }
  }
  return "Unknown";
}

module.exports = mapCity;

