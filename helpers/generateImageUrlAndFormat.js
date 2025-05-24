// This file gets the image URL and returns formatted object

// Imports
const { getPresignedUrl } = require("../helpers/AWS");
const getErrorObj = require("./getErrorObj");

module.exports = async function generateImageUrlAndFormat(fileName) {
  if (typeof fileName !== "string") {
    throw getErrorObj("filename must be a string");
  }
  return {
    fileName,
    signedUrl: await getPresignedUrl(fileName),
  };
};
