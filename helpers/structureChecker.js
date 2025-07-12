// This module verifies if two objects or two arrays are equal
const _ = require("lodash");

module.exports = function (structure1 = [], structure2 = [], exclude = []) {
  // structure1 is the blueprint, structure2 is provided keys
  let providedKeys = [...structure2];

  // Remove the keys iteratively
  if (Array.isArray(exclude) && exclude.length > 0) {
    const providedKeySet = new Set(providedKeys);
    exclude.forEach((key) => {
      if (providedKeySet.has(key)) {
        providedKeys.splice(providedKeys.indexOf(key), 1);
      }
    });
  }
  //!delete console.log(structure1, providedKeys);
  return _.isEqual([...structure1].sort(), [...providedKeys].sort());
};
