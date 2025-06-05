/**
 * Helper Model
 * * First Degree Creator
 */

const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const { getErrorObj } = require("../helpers/getErrorObj");

// First Degree Creator Schema
const FirstDegreeCreatorSchema = new Schema(
  {
    upID: { type: String, required: true, unique: true },
    fdcID: { type: String, required: true, unique: true },
    creatorName: { type: String, required: true },
    creatorBio: { type: String, default: "" },
    creatorImage: {
      type: String,
      default: () => process.env.DEFAULT_USER_FILENAME,
    },
    uploaderEmployeeID: { type: String, required: true },
  },
  { timestamps: true, collection: "firstDegreeCreator" }
);

// Get an FDC by ID
FirstDegreeCreatorSchema.statics.getFdcByID = async function (ID) {
  return await this.findOne({ fdcID: ID });
};

// Create a new FDC
FirstDegreeCreatorSchema.statics.createNewFDC = async function (
  fdcData,
  session = null
) {
  const newFDC = new FirstDegreeCreator(fdcData);
  await newFDC.save({ session });
  return newFDC;
};

// Get all the FDCs
FirstDegreeCreatorSchema.statics.getAllFDCs = function () {
  return this.find({}).select("-__v -_id -createdAt -updatedAt");
};

// First Degree Creator validation fields
FirstDegreeCreatorSchema.statics.getKeys = function () {
  // Excluded fields
  const exclude = [
    "fdcID",
    "upID",
    "_id",
    "__v",
    "createdAt",
    "updatedAt",
    "creatorImage",
    "uploaderEmployeeID",
  ];
  const allowedKeys = Object.keys(this.schema.paths)
    .map((key) => key.split(".").pop())
    .filter((key) => !exclude.includes(key));
  const keys = [...new Set(allowedKeys)];
  return keys;
};

FirstDegreeCreatorSchema.statics.updateAnFdc = async function (fdcID, fdcData) {
  // Find the Fdc
  const fdc = await this.findOne({ fdcID });

  // If no Fdc is found
  if (!fdc) {
    throw getErrorObj("No fdc found with the provided fdcID", 400);
  }

  // Merge the updated data with the existing fdc
  Object.assign(fdc, fdcData);

  return await fdc.save();
};

// Delete many FDCs with fdcIDs array
FirstDegreeCreatorSchema.statics.deleteByIDs = async function (fdcIDsArr) {
  // 1. Find docs to get upIDs
  const docsToDelete = await this.find(
    { fdcID: { $in: fdcIDsArr } },
    { upID: 1, _id: 0 }
  );
  const upIDs = docsToDelete.map((doc) => doc.upID);

  // 2. Delete the documents
  const result = await this.deleteMany({ fdcID: { $in: fdcIDsArr } });

  // 3. Return both deletedCount and upIDs
  return {
    deletedCount: result.deletedCount,
    upIDs,
  };
};

// Delete one FDC with ID
FirstDegreeCreatorSchema.statics.deleteByFdcID = async function (
  fdcID,
  session = null
) {
  // If no fdcID is provided
  if (!fdcID) {
    throw new Error("fdcID is required");
  }

  // Prepare options
  const opts = session ? { session } : {};

  // Check existence (inside session if provided)
  const existing = await this.findOne({ fdcID }, null, opts);
  if (!existing) {
    throw getErrorObj(`No FirstDegreeCreator found with fdcID provided`, 400);
  }

  // Delete the document (inside session if provided)
  const deletedFdc = await this.findOneAndDelete({ fdcID }, opts);
  return deletedFdc;
};

// Get all the FDC IDs
FirstDegreeCreatorSchema.statics.getIDs = async function (excludeID) {
  const filter = excludeID ? { fdcID: { $ne: excludeID } } : {};
  const result = await this.find(filter, { fdcID: 1, _id: 0 });
  console.log(result.map((doc) => doc.fdcID));
  return result.map((doc) => doc.fdcID);
};

const FirstDegreeCreator = mongoose.model(
  "FirstDegreeCreator",
  FirstDegreeCreatorSchema,
  "firstDegreeCreator"
);

module.exports = FirstDegreeCreator;
