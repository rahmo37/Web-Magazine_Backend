/**
 * * UploadTracker
 * This model keep track of the images for every entity
 */

const mongoose = require("mongoose");
const { Schema } = mongoose;
const { getErrorObj } = require("../helpers/getErrorObj");

// Schema for ImageTracker
const UploadTrackerSchema = new Schema(
  {
    upID: { type: String, unique: true },
    fileNames: { type: [String], default: [] },
  },
  { timestamps: true, collection: "uploadTracker" }
);

// Create a new upload tracker (optionally using a session)
UploadTrackerSchema.statics.createTracker = async function (
  upID,
  fileNames = [],
  session = null
) {
  if (typeof upID !== "string") {
    throw getErrorObj(`You must provide a valid upID`, 400);
  }

  const tracker = new this({ upID, fileNames });

  return session ? await tracker.save({ session }) : await tracker.save();
};

// Retrieve the UpTracker instance if exists
UploadTrackerSchema.statics.getTracker = async function (upID) {
  return await this.findOne({ upID });
};

// Adds new files to the tracker
UploadTrackerSchema.methods.addFiles = async function (newFiles) {
  // if just a string, wrap it in an array or if falsy, use empty array
  const filesArray = Array.isArray(newFiles)
    ? newFiles
    : newFiles
    ? [newFiles]
    : [];

  if (filesArray.length === 0) {
    throw new Error("addFiles expects a filename or an array of filenames");
  }

  // Append all items
  this.fileNames.push(...filesArray);

  // Optional: deduplicate
  // this.fileNames = [...new Set(this.fileNames)];

  return this.save();
};

// An upload ID will be provided and corresponding tracker will be deleted
UploadTrackerSchema.statics.deleteTrackerByUpID = async function (upID) {
  if (typeof upID !== "string" || !upID.trim()) {
    throw getErrorObj("A valid upID must be provided to delete a tracker", 400);
  }
  const deletedTracker = await this.findOneAndDelete({ upID });
  if (!deletedTracker) {
    throw getErrorObj("No tracker found to delete with the given upID", 404);
  }
  return deletedTracker;
};

// An upload ID will be sent and fileNames will be sent, and will perform manual delete from the Database, and return the delete count
UploadTrackerSchema.statics.removeFilesFromTracker = async function (
  upID,
  filesToRemove
) {
  if (typeof upID !== "string" || !upID.trim()) {
    throw getErrorObj("A valid upID must be provided to remove files", 400);
  }
  if (!filesToRemove) {
    throw getErrorObj("No files specified for removal", 400);
  }

  const filesArr = Array.isArray(filesToRemove)
    ? filesToRemove
    : [filesToRemove];
  if (filesArr.length === 0) return 0;

  const tracker = await this.findOne({ upID });
  if (!tracker) {
    throw getErrorObj("No tracker found with the given upID", 404);
  }

  // Filter out files to remove and count how many were removed
  const originalCount = tracker.fileNames.length;
  tracker.fileNames = tracker.fileNames.filter(
    (fname) => !filesArr.includes(fname)
  );
  const deletedCount = originalCount - tracker.fileNames.length;

  if (deletedCount > 0) {
    await tracker.save();
  }
  return deletedCount;
};

// Replace fileNames in a tracker by upID (optionally using a session)
UploadTrackerSchema.statics.replaceFilesInTracker = async function (
  upID,
  newFileNames,
  session = null
) {
  if (typeof upID !== "string" || !upID.trim()) {
    throw getErrorObj("A valid upID must be provided to replace files", 400);
  }

  const filesArr = Array.isArray(newFileNames) ? newFileNames : [newFileNames];

  const tracker = await this.findOne({ upID });
  if (!tracker) {
    throw getErrorObj("No tracker found with the given upID", 404);
  }

  tracker.fileNames = filesArr;
  return session ? await tracker.save({ session }) : await tracker.save();
};

// Creating Model
const UploadTracker = mongoose.model(
  "UploadTracker",
  UploadTrackerSchema,
  "uploadTracker"
);

module.exports = UploadTracker;
