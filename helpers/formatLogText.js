// This module adds dashes in the provided text and returns
const colors = require("colors");

module.exports = function formatLogText(text, obj) {
  if (obj !== null && typeof obj !== "object") {
    obj = "";
  } else {
    obj = JSON.stringify(obj);
  }

  const formattedText = `\n--------------------------------\n${text} ${obj}\n--------------------------------\n`;

  // Define a list of available colors from the 'colors' module
  const colorOptions = ["red", "green", "yellow", "blue", "magenta", "cyan"];

  // Pick one randomly
  const randomColor =
    colorOptions[Math.floor(Math.random() * colorOptions.length)];

  // Return the colored and formatted text
  return colors[randomColor](formattedText);
};
