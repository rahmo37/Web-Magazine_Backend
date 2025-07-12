// This file handles image uploads, using Multer to extract the images from the request
const multer = require("multer");

// ! Multer Configurations
// Store files in memory for further processing by Multer
const storage = multer.memoryStorage();

// Multer conditions
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
});

// Middleware to handle up to 5 images per request, field name is 'images'
const multerImageInjection = upload.array("images", 5);


module.exports = multerImageInjection;