// This function rollbacks the images that are uploaded in s3 and in tracker.

/**
 * Rolls back uploaded images in both S3 and the UploadTracker database.
 * Depending on parameters, deletes images from S3, removes file references from tracker,
 * and optionally deletes the tracker itself.
 */

// Importing necessary modules
const UploadTracker = require("../models/UploadTracker");
const { getErrorObj } = require("./getErrorObj");
const findModule = require("./findModulePath");
const assignJob = require("./assignJob");

// Generic message used in error construction
const genericMessage = "rollback failed";

/**
 * Main rollback function
 * @param {String} upID - Upload tracker ID
 * @param {Array<String>} passedInFileNames - (Optional) Specific files to rollback
 * @param {Boolean|null} deleteTracker - (Optional) Whether to delete tracker; null to auto-decide
 */
module.exports = async function rollbackOnUploadFailure(
  upID,
  passedInFileNames = null,
  deleteTracker = null,
  req = null
) {
  // Validate parameters
  assertValidPassedInFileNames(passedInFileNames);
  assertValidUpID(upID);
  assertDeleteTracker(deleteTracker);

  // Fetch tracker
  const tracker = await UploadTracker.getTracker(upID);

  // If no tracker found and no files are passed-in, we return from the function
  if (!tracker && !passedInFileNames) {
    return "No tracker found. Nothing to rollback.";
  }

  // Determine filenames to delete and tracker action based on request method
  const method = req?.method;

  // Deleted fileNames will be saved here
  let fileNames = [];

  // Variable for appropriate message
  let actionMessage = "";

  //  If the method is PATCH or PUT we look-into the staged files
  if (method === "PATCH" || method === "PUT") {
    // On PATCH or PUT: delete files from stagedFileNames
    if (!tracker || tracker.stagedFileNames.length === 0) {
      return "No staged files to delete.";
    }

    // Retrieve the staged fileNames
    fileNames = [...tracker.stagedFileNames];


    try {
      // Delete from s3
      const s3DeleteResult = await assignJob(
        findModule("AWS.js"),
        "deleteMany",
        [fileNames]
      );

      // Empty the staged file names
      await UploadTracker.emptyStagedFileNames(tracker.upID);

      // Prepare message
      actionMessage = `${s3DeleteResult} staged file(s) deleted from S3 and tracker.`;
    } catch (error) {
      throw getErrorObj(`Rollback failed: ${error.message}`, 500);
    }
  } 
  // If the method is DELETE, POST or no method is provided
  else if (method === "DELETE" || method === "POST" || !method) {
    // Determine if we need to delete the tracker
    let isDeleteTracker = deleteTracker;

    // If tracker is marked to be deleted, we set passedInFileNames parameter to null
    if (deleteTracker) {
      passedInFileNames = null;
    }

    // If no passed-in file names
    if (!passedInFileNames) {

      // We gather the fileNames from the tracker, or set the names to empty array
      fileNames = tracker ? [...tracker.fileNames] : [];

      // If tracker deletion is set to null here, but no passed-in file names are provided, we assume that we need to delete the tracker
      if (deleteTracker === null) isDeleteTracker = true;
    } else {
      if (!tracker) {
        throw getErrorObj(
          getErrorMessage(
            `Inconsistency: Tracker not found for upID '${upID}' but filenames provided.`
          )
        );
      }
      fileNames = [...passedInFileNames];
      if (deleteTracker === null) isDeleteTracker = false;
    }

    try {
      const s3DeleteResult = await assignJob(
        findModule("AWS.js"),
        "deleteMany",
        [fileNames]
      );

      if (isDeleteTracker) {
        const dbDeleteResult = await UploadTracker.deleteTrackerByUpID(upID);
        actionMessage = dbDeleteResult
          ? `${s3DeleteResult} files deleted from S3, and the tracker is deleted.`
          : "S3 files deleted, but failed to delete tracker. Follow-up required!";
      } else {
        const deletedCount = await UploadTracker.removeFilesFromTracker(
          upID,
          fileNames
        );
        actionMessage = `${s3DeleteResult} files deleted from S3, ${deletedCount} files deleted from tracker.`;
      }
    } catch (error) {
      throw getErrorObj(`Rollback failed: ${error.message}`, 500);
    }
  } else {
    return "Invalid request method. No action taken.";
  }

  return `${actionMessage} NOTE: Default user or placeholder files will not be deleted from S3.`;
};

// Helper validation functions
function assertValidPassedInFileNames(passedInFileNames) {
  if (passedInFileNames !== null && !Array.isArray(passedInFileNames)) {
    throw getErrorObj(
      getErrorMessage("passedInFileNames must be an array of strings or null")
    );
  }
  if (
    Array.isArray(passedInFileNames) &&
    passedInFileNames.some((f) => typeof f !== "string")
  ) {
    throw getErrorObj(
      getErrorMessage("passedInFileNames must contain only strings")
    );
  }
}

function assertValidUpID(upID) {
  if (typeof upID !== "string" || !upID.trim()) {
    throw getErrorObj(getErrorMessage("upID must be a non-empty string"));
  }
}

function assertDeleteTracker(value) {
  if (![null, true, false].includes(value)) {
    throw new Error("deleteTracker must be either null, true, or false.");
  }
}

function getErrorMessage(msg) {
  return `${msg}. Rollback failed.`;
}

