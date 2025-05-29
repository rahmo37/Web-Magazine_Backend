// This file return the absolute path no matter where the file is.
//  We should use this module extensively since it recursively looks into every directory no matter upward or downward
const fs = require("fs");
const path = require("path");

// Recursive search in this directory and all subdirectories
function searchDownward(dir, targetFile) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      const result = searchDownward(fullPath, targetFile);
      if (result) return result;
    } else if (file === targetFile) {
      return path.resolve(fullPath);
    }
  }
  return null;
}

// Search upward, and downward at each level
function findModuleUpward(startDir, targetFile) {
  let currentDir = startDir;

  while (true) {
    const found = searchDownward(currentDir, targetFile);
    if (found) return found;

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break; // reached root
    currentDir = parentDir;
  }

  return null;
}

module.exports = function (moduleName, startDir = __dirname) {
  return findModuleUpward(startDir, moduleName);
};
