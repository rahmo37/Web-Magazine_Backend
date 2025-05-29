// This file handles image uploads, using Multer to extract the images from the request
const multer = require("multer");
const UploadTracker = require("../models/UploadTracker");
const rollbackOnUploadFailure = require("../helpers/rollbackOnUploadFailure");
const { getErrorObj } = require("../helpers/getErrorObj");
const { sendRequest } = require("../helpers/sendRequest");
const findModule = require("../helpers/findModulePath");
const assignJob = require("../helpers/assignJob");

// Module scaffolding
const imageOperations = {};

// This function uploads a batch of images to S3.
imageOperations.uploadBatchedImages = async function (req, res, next) {
  // If no files found we assume no images uploaded
  if (!req.files || req.files.length === 0) {
    return next();
  }

  //  If no metadata provided
  if (!req.body.meta) {
    return next(getErrorObj("No image metadata provided", 400));
  }

  const imageMetadata = { ...req.body.meta };

  // Retrieve an existing tracker if any
  let tracker = await UploadTracker.getTracker(imageMetadata.upID);

  try {
    // If a tracker exists and the batch number is 1 or a tracker doesn't exists but batch number is not 1
    if (
      (tracker && imageMetadata.batchNumber === 1) ||
      (!tracker && imageMetadata.batchNumber !== 1)
    ) {
      const msg = tracker
        ? "A tracker already exists with the provided upID"
        : "You must provide the upID with your upload request";
      return next(getErrorObj(msg, 400));
    }

    if (imageMetadata.batchNumber === 5) {
      throw getErrorObj("testing rollback");
    }

    // If no tracker then we create one
    if (!tracker) {
      tracker = await UploadTracker.createTracker(imageMetadata.upID);
    }

    // Upload all files (in parallel)
    const fileNamesInCurrentBatch = await assignJob(
      findModule("AWS.js"),
      "uploadMany",
      [req.files]
    );

    // Updated the tracker
    const updatedTracker = await tracker.addFiles(fileNamesInCurrentBatch);

    // Send the updatedTracker
    return sendRequest({
      res,
      statusCode: 200,
      message: `Batch uploaded ${imageMetadata.batchNumber}`,
      data: updatedTracker,
    });
  } catch (error) {
    try {
      if (tracker) {
        const result = await rollbackOnUploadFailure(
          tracker.upID,
          tracker.fileNames
        );
        console.log(result);
      } else {
        console.log("No tracker found. Nothing to rollback.");
      }
    } catch (rollbackError) {
      next(rollbackError);
    }
    return next(error);
  }
};

// Export the middleware
module.exports = imageOperations;
