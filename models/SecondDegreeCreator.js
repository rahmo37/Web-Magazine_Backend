/**
 * Helper Model
 * * Second Degree Creator
 */

const mongoose = require("mongoose");

const Schema = mongoose.Schema;

// Second Degree Creator Schema
const SecondDegreeCreatorSchema = new Schema(
  {
    sdcID: { type: String, required: true, unique: true },
    creatorName: { type: String, required: true },
    creatorBio: { type: String, default: "" },
    creatorImage: {
      type: String,
      default: () => process.env.DEFAULT_USER_FILENAME,
    },
    uploaderEmployeeID: { type: String, required: true },
  },
  { timestamps: true, collection: "secondDegreeCreator" }
);

// Get an employee by ID
SecondDegreeCreatorSchema.statics.getSdcByID = async function (ID) {
  return await this.findOne({ sdcID: ID });
};

// Create a new SDC
SecondDegreeCreatorSchema.statics.createNewSDC = async function (
  sdcData,
  session = null
) {
  const newSDC = new SecondDegreeCreator(sdcData);
  await newSDC.save({ session });
  return newSDC;
};

// Get all the SDCs
SecondDegreeCreatorSchema.statics.getAllSDCs = function () {
  return this.find({}).select("-__v -_id -createdAt -updatedAt");
};

SecondDegreeCreatorSchema.statics.updateAnSdc = async function (
  sdcID,
  sdcData
) {
  // Find the Sdc
  const sdc = await this.findOne({ sdcID });

  // If no Sdc is found
  if (!sdc) {
    throw getErrorObj("No sdc found with the provided sdcID", 400);
  }

  // Merge the updated data with the existing sdc
  Object.assign(sdc, sdcData);

  return await sdc.save();
};

// Get the SDC model keys
SecondDegreeCreatorSchema.statics.getKeys = function () {
  // Excluded fields
  const exclude = [
    "sdcID",
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

// Delete many SDCs with sdcIDs array
SecondDegreeCreatorSchema.statics.deleteByIDs = async function (sdcIDsArr) {
  const result = await SecondDegreeCreator.deleteMany({
    sdcID: { $in: sdcIDsArr },
  });
  return result.deletedCount;
};

// Delete one SDC with ID
SecondDegreeCreatorSchema.statics.deleteBySdcID = async function (
  sdcID,
  session = null
) {
  // If no sdcID is provided
  if (!sdcID) {
    throw new Error("sdcID is required");
  }

  // Prepare options
  const opts = session ? { session } : {};

  // Check existence (inside session if provided)
  const existing = await this.findOne({ sdcID }, null, opts);
  if (!existing) {
    throw getErrorObj(`No SecondDegreeCreator found with sdcID provided`, 400);
  }

  // Delete the document (inside session if provided)
  const result = await this.deleteOne({ sdcID }, opts);
  return result;
};

// Get all the SDC IDs
SecondDegreeCreatorSchema.statics.getIDs = async function (excludeID) {
  const filter = excludeID ? { sdcID: { $ne: excludeID } } : {};
  const result = await this.find(filter, { sdcID: 1, _id: 0 });
  console.log(result.map((doc) => doc.sdcID));
  return result.map((doc) => doc.sdcID);
};

const SecondDegreeCreator = mongoose.model(
  "SecondDegreeCreator",
  SecondDegreeCreatorSchema,
  "secondDegreeCreator"
);

module.exports = SecondDegreeCreator;
