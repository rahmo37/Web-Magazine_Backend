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
    upID: { type: String },
    fileNames: { type: [String], default: [] },
  },
  { timestamps: true, collection: "uploadTracker" }
);

//  Create a new upload tracker
UploadTrackerSchema.statics.createTracker = async function (
  upID,
  fileNames = []
) {
  if (typeof upID !== "string") {
    throw getErrorObj(`You must provide a valid upID`, 400);
  }
  const tracker = new this({ upID, fileNames });
  return await tracker.save();
};

// Retrieve the UpTracker instance if exists
UploadTrackerSchema.statics.getTracker = async function (upID) {
  return await this.findOne({ upID });
};

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
UploadTrackerSchema.statics.deleteByUpID = async function (upID) {
  if (typeof upID !== "string" || !upID.trim()) {
    throw getErrorObj("A valid upID must be provided to delete a tracker", 400);
  }

  const result = await this.deleteOne({ upID });
  return result.deletedCount;
};

// Creating Model
const UploadTracker = mongoose.model(
  "UploadTracker",
  UploadTrackerSchema,
  "uploadTracker"
);

module.exports = UploadTracker;
