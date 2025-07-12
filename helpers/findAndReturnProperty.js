module.exports = function findAndReturnProperty(obj, propName) {
  // Check each property in the object
  for (let key in obj) {
    // If we find the property, return its value
    if (key === propName) {
      return obj[key];
    }
    // If the value is an object, search inside it
    if (typeof obj[key] === "object" && obj[key] !== null) {
      const found = findAndReturnProperty(obj[key], propName);
      if (found !== null) {
        return found; // If found in the nested object, return it
      }
    }
  }
  // If the property wasn't found anywhere, return null
  return null;
}
