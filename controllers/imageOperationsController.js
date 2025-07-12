// This file handles image uploads, using Multer to extract the images from the request
const UploadTracker = require("../models/UploadTracker");
const rollbackOnUploadFailure = require("../helpers/rollbackOnUploadFailure");
const { getErrorObj } = require("../helpers/getErrorObj");
const { sendRequest } = require("../helpers/sendRequest");
const findModule = require("../helpers/findModulePath");
const assignJob = require("../helpers/assignJob");
const findAndReturnProperty = require("../helpers/findAndReturnProperty");

// Module scaffolding
const imageOperations = {};

// This function uploads a batch of images to S3.
imageOperations.uploadBatchedImages = async function (req, res, next) {
  // If no files found we assume no images uploaded
  if (!req.files || req.files.length === 0) {
    let upID = findAndReturnProperty(req.body, "upID");

    // If an upID is found in the request, we try to retrieve the existing tracker. If no tracker is found, we create a new one and attach it to the req object.
    if (upID) {
      // Retrieve the existing tracker
      let tracker = (await UploadTracker.getTracker(upID))?.toObject();

      // If a tracker is found but the method is POST and the tracker has no files,
      // then any attempt to reuse this redundant tracker will be caught by subsequent middleware,
      // which will throw an error due to inconsistencies.
      if (tracker && req.method === "POST" && tracker.fileNames.length === 0) {
        return next(
          getErrorObj("A tracker with the provided upID already exists.", 400)
        );
      }

      // If no tracker and the method is post, we create a new one
      if (!tracker && req.method === "POST") {
        tracker = (await UploadTracker.createTracker(upID))?.toObject();
      }

      // Finally we attach the tracker to the req object
      req.tracker = tracker;
    }
    return next();
  }

  // From here we Are sure that request body has images
  //  If no metadata provided
  if (!req.body.meta) {
    return next(getErrorObj("No image metadata provided", 400));
  }

  const imageMetadata = { ...req.body.meta };

  // If no upID or batchNumber is provided
  if (!imageMetadata.upID || !imageMetadata.batchNumber) {
    return next(getErrorObj("Metadata must contain upID and batchNumber", 400));
  }

  // Retrieve an existing tracker if any
  let tracker = await UploadTracker.getTracker(imageMetadata.upID);

  try {
    // If a tracker exists and the batch number is 1 or a tracker doesn't exists but batch number is not 1
    if (
      (tracker && imageMetadata.batchNumber === 1 && req.method === "POST") ||
      (!tracker && imageMetadata.batchNumber !== 1)
    ) {
      const msg = tracker
        ? "A tracker already exists with the provided upID"
        : "BatchNumber is more than 1 however no tracker found. Please provide a correct upID with the request";
      return next(getErrorObj(msg, 400));
    }
    // If the request is patch or put, but their is no tracker
    else if (!tracker && req.method !== "POST") {
      return next(
        getErrorObj("Received a PATCH/PUT request, but no tracker found", 400)
      );
    }

    //  Destructure the image files
    let imageFiles = [...req.files];

    // If tracker is found and the method is not post (patch or put)
    // We do not re-upload same image thus, we filter out the existing images
    if (tracker && req.method !== "POST") {
      const fileSet = new Set(tracker.fileNames);
      imageFiles = imageFiles.filter((file) => !fileSet.has(file.originalname));
    }

    // ! Delete later
    // if (imageMetadata.batchNumber === 2) {
    //   throw getErrorObj("testing rollback");
    // }

    // Upload all files (in parallel)
    const fileNamesInCurrentBatch = await assignJob(
      findModule("AWS.js"),
      "uploadMany",
      [imageFiles]
    );

    // If no tracker then we create one
    if (!tracker && req.method === "POST") {
      tracker = await UploadTracker.createTracker(imageMetadata.upID);
    }

    // If fileNames needs to be staged we use this variable
    let needStaging = false;
    if (req.method === "PATCH" || req.method === "PUT") {
      needStaging = true;
    }

    // Update the tracker
    const updatedTracker = await tracker.addFiles(
      fileNamesInCurrentBatch,
      needStaging
    );

    // Send the updatedTracker
    return sendRequest({
      res,
      statusCode: 200,
      message: `Batch uploaded ${imageMetadata.batchNumber}`,
      data: updatedTracker,
    });
  } catch (error) {
    console.error("Batch upload error:", error);

    // try {
    //   if (tracker) {
    //     const result = await rollbackOnUploadFailure(tracker.upID);
    //     console.log("Rollback successful:", result);
    //   } else {
    //     console.log("No tracker found. Nothing to rollback.");
    //   }
    // } catch (rollbackError) {
    //   // Explicitly log rollback error for easier debugging.
    //   console.error("Rollback error:", rollbackError);
    //   return next(rollbackError);
    // }
    return next(error);
  }
};

// Export the middleware
module.exports = imageOperations;
