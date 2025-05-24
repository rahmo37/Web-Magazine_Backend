// This function rollbacks the images that are uploaded in s3 and in tracker.

// Importing necessary modules
const { deleteMany } = require("./AWS");
const UploadTracker = require("../models/UploadTracker");
const { getErrorObj } = require("./getErrorObj");
const genericMessage = "rollback failed";

module.exports = async function rollbackOnUploadFailure(
  upID,
  passedInFileNames = null
) {
  // Validate parameters
  assertValidPassedInFileNames(passedInFileNames);
  assertValidUpID(upID);

  let fileNames = [];

  // Retrieve tracker from DB
  const tracker = await UploadTracker.getTracker(upID);

  if (!passedInFileNames) {
    if (!tracker) {
      return "No tracker found. Nothing to rollback.";
    }
    fileNames = [...tracker.fileNames];
  } else {
    if (!tracker && passedInFileNames !== null) {
      throw getErrorObj(
        getErrorMessage(
          `Inconsistency detected: files may exist in S3 but aren't recorded in the Upload Tracker`
        )
      );
    }
    fileNames = [...passedInFileNames];
  }

  // Rollback operations wrapped in try-catch
  try {
    const s3DeleteResult = await deleteMany(fileNames);
    const dbDeleteResult = await UploadTracker.deleteByUpID(upID);

    return `${s3DeleteResult} file(s) deleted from S3 and ${
      dbDeleteResult ? fileNames.length : "0"
    } record(s) deleted from the database. Please verify that both counts match.`;
  } catch (error) {
    throw getErrorObj(`Rollback operation failed: ${error.message}`, 500);
  }
};

//* Helpers
// upID is required → must be a string, cannot be null or undefined.
// passedInFileNames is optional, but:
// if present, it must be:
// an empty array ✅
// or an array of strings ✅
// and if not present → null is okay ✅
function assertValidPassedInFileNames(passedInFileNames) {
  if (passedInFileNames !== null && !Array.isArray(passedInFileNames)) {
    throw getErrorObj(
      getErrorMessage("passedInFileNames must be null or an array of strings")
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

function assertValidUpID(upID) {
  if (typeof upID !== "string" || !upID.trim()) {
    throw getErrorObj(getErrorMessage("upID must be a non-empty string"));
  }
}

function getErrorMessage(message) {
  return `${message}. ${genericMessage}`;
}
