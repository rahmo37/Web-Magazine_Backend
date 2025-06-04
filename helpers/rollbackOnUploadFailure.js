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
  deleteTracker = null
) {
  // ---------------- Parameter Validation ----------------
  assertValidPassedInFileNames(passedInFileNames);
  assertValidUpID(upID);
  assertDeleteTracker(deleteTracker);

  // Determines whether to delete the tracker as well
  let isDeleteTracker = deleteTracker;

  // If full tracker deletion is requested, ignore any passedInFileNames to avoid partial deletion
  if (deleteTracker) {
    passedInFileNames = null;
  }

  // The filenames to be rolled back (from tracker or passed in)
  let fileNames = [];

  // Message for reporting the result
  let message = "";

  // Retrieve tracker from DB
  const tracker = await UploadTracker.getTracker(upID);

  // ----------------- Tracker/File Logic -----------------
  if (!passedInFileNames) {
    // If no filenames provided, check for tracker
    if (!tracker) {
      return "No tracker found. Nothing to rollback.";
    }
    fileNames = [...tracker.fileNames];

    // If caller didn't specify deleteTracker and no files given, default to delete tracker
    if (deleteTracker === null) {
      isDeleteTracker = true;
    }
  } else {
    // If filenames provided but no tracker exists, it's a logical error (inconsistency)
    if (!tracker) {
      throw getErrorObj(
        getErrorMessage(
          `Inconsistency detected: Tracker for upID '${upID}' not found, but filenames provided. Files may exist in S3 without tracker records.`
        )
      );
    }
    fileNames = [...passedInFileNames];

    // If caller didn't specify deleteTracker and files given, default to partial removal
    if (deleteTracker === null) {
      isDeleteTracker = false;
    }
  }

  // --------------- Main Rollback Operations ---------------
  try {
    // Delete files from S3 using a worker thread for efficiency
    const s3DeleteResult = await assignJob(findModule("AWS.js"), "deleteMany", [
      fileNames,
    ]);

    if (isDeleteTracker) {
      // Delete the full tracker and report how many files were tracked
      const dbDeleteResult = await UploadTracker.deleteTrackerByUpID(upID);

      if (dbDeleteResult) {
        message = `and ${dbDeleteResult.fileNames.length} files deleted from DB. Tracker also deleted.`;
      } else {
        message =
          "However, failed to delete tracker and its files from DB. Immediate follow-up required!";
      }
    } else {
      // Remove only specific files from the tracker
      const deletedCount = await UploadTracker.removeFilesFromTracker(
        upID,
        fileNames
      );
      message = `and ${deletedCount} files deleted from tracker. Verify counts match.`;
    }

    // Return a summary of what happened
    return `${String(
      s3DeleteResult
    )} file(s) deleted from S3 ${message} NOTE: If default user or placeholder file name is provided. They will not be deleted from s3.`;
  } catch (error) {
    // Catch any unexpected errors and wrap in custom error object
    throw getErrorObj(`Rollback operation failed: ${error.message}`, 500);
  }
};

//* Helper Functions
/**
 * Validates passedInFileNames:
 * - must be null, or an array of strings, or empty array
 */
function assertValidPassedInFileNames(passedInFileNames) {
  if (passedInFileNames !== null && !Array.isArray(passedInFileNames)) {
    throw getErrorObj(
      getErrorMessage(
        "passedInFileNames, if provided, must be an array of strings or null"
      )
    );
  }
  if (
    Array.isArray(passedInFileNames) &&
    passedInFileNames.some((each) => typeof each !== "string")
  ) {
    throw getErrorObj(
      getErrorMessage("passedInFileNames must only contain string file names")
    );
  }
}

/**
 * Validates upID: must be a non-empty string
 */
function assertValidUpID(upID) {
  if (typeof upID !== "string" || !upID.trim()) {
    throw getErrorObj(getErrorMessage("upID must be a non-empty string"));
  }
}

/**
 * Utility to format error messages
 */
function getErrorMessage(message) {
  return `${message}. ${genericMessage}`;
}

/**
 * Validates deleteTracker: must be true, false, or null
 */
function assertDeleteTracker(value) {
  if (value !== null && value !== true && value !== false) {
    throw new Error("deleteTracker must be either null, true, or false.");
  }
}
