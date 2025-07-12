/**
 * Helper Model
 * * Link
 */

// Importing packages
const mongoose = require("mongoose");
const FirstDegreeCreator = require("./FirstDegreeCreator");
const SecondDegreeCreator = require("./SecondDegreeCreator");
const Employee = require("./Employee");
const { getErrorObj } = require("../helpers/getErrorObj");

// Necessary variables
const hemantoFdcID = process.env.HEMANTO_FDCID;
const hemantoSdcID = process.env.HEMANTO_SDCID;

// creating schema instance
const Schema = mongoose.Schema;

// Link Schema
const LinkSchema = new Schema(
  {
    linkID: { type: String, required: true, unique: true },
    employeeID: { type: String, required: true },
    contentID: { type: String, required: true, unique: true },
    fdcID: { type: String, required: true },
    sdcID: { type: String, required: false },
    contentStatus: { type: String, required: true },
  },
  { timestamps: true, collection: "link" }
);

LinkSchema.statics.getByContentIDPrefixAndEmpID = async function (
  idPrefix,
  employeeID = null
) {
  try {
    // Build the query object with a regex for contentID prefix
    const query = { contentID: { $regex: `^${idPrefix}` } };
    // If employeeID is provided, add it to the query
    if (employeeID) {
      query.employeeID = employeeID;
    }

    const projection = { _id: 0, __v: 0, createdAt: 0, updatedAt: 0 };

    return await this.find(query, projection);
  } catch (error) {
    throw error;
  }
};

LinkSchema.statics.getByContentID = async function (contentID) {
  return await this.findOne({ contentID });
};

// Return the content if both the contentID and the EmployeeID exists in a Link
LinkSchema.statics.getByContentIDAndEmpID = async function (
  contentID,
  employeeID
) {
  return await Link.findOne({ contentID, employeeID });
};

LinkSchema.statics.getEntityIDs = async function (entityID, excludeID) {
  const projection = { [entityID]: 1, _id: 0 };
  const result = await this.find({}, projection);
  return result
    .map((doc) => doc[entityID])
    .filter((id) => id && id !== excludeID);
};

LinkSchema.statics.createLink = async function (linkData, session) {
  const newLink = new Link(linkData);
  await newLink.save({ session });
  return newLink;
};

LinkSchema.statics.deleteByContentID = async function (
  contentID,
  session = null
) {
  // build the delete query
  let query = this.deleteOne({ contentID });

  // if a session was provided, attach it
  if (session) {
    query = query.session(session);
  }

  const result = await query;
  if (result.deletedCount === 0) {
    throw new Error(`No link found with contentID "${contentID}"`);
  }
  return true;
};

// Deletes all docs matching one ID field, optionally in a transaction session
LinkSchema.statics.deleteManyWithID = async function (
  idType,
  idValue,
  session = null
) {
  // if no ID provided, nothing to delete
  if (!idType || !idValue) {
    return { deletedCount: 0 };
  }

  // Build filter dynamically
  const filter = { [idType]: idValue };

  // only include session in options if it’s truthy
  const options = {};
  if (session) options.session = session;

  // perform deleteMany
  return this.deleteMany(filter, options);
};

// Only returns the links that matches all the IDs passed-in in that link
LinkSchema.statics.findByAllIds = async function (providedIDs = {}) {
  let IDs = null;

  // If ID is passed as a String
  if (typeof providedIDs === "string") {
    // Extract the prefix before the first underscore and append "ID" to form
    // the appropriate field name (e.g. "fdc_abc" -> "fdcID")
    const key = `${providedIDs.split("_")[0]}ID`;
    IDs = { [key]: providedIDs };
  } else {
    IDs = { ...providedIDs };
  }

  // Build an AND‐style filter: only fields actually passed will be matched
  const filter = {};
  if (IDs.linkID) filter.linkID = IDs.linkID;
  if (IDs.employeeID) filter.employeeID = IDs.employeeID;
  if (IDs.contentID) filter.contentID = IDs.contentID;
  if (IDs.fdcID) filter.fdcID = IDs.fdcID;
  if (IDs.sdcID) filter.sdcID = IDs.sdcID;

  // If no IDs were provided, return an empty array
  if (Object.keys(filter).length === 0) {
    return [];
  }

  // Perform the query: only links matching **all** the provided IDs
  return await this.find(filter);
};

// Updates the fdcIDs to hemantoFdcIds if it's sdcID is null
LinkSchema.statics.updateFdcIDWhenSdcIsNull = async function (targetFdcID) {
  // Check that at least one link exists with the given fdcID
  const exists = await this.exists({ fdcID: targetFdcID });
  if (!exists) {
    throw getErrorObj(`No links found with fdcID: ${targetFdcID}`, 400);
  }

  // Update only those whose sdcID is null
  const filter = { fdcID: targetFdcID, sdcID: null };
  const update = { $set: { fdcID: hemantoFdcID } };
  const result = await this.updateMany(filter, update);

  return result; // contains matchedCount and modifiedCount
};

// An sdcID is provided, and its corresponding link's sdcID i changed to HemantoID
LinkSchema.statics.updateSdcIDToHemantoID = async function (targetSdcID) {
  // Check that at least one link exists with the given sdcID
  const exists = await this.exists({ sdcID: targetSdcID });

  //  If does not exists
  if (!exists) {
    throw getErrorObj(`No links found with sdcID: ${targetSdcID}`, 400);
  }

  // Update the sdc
  const result = await this.updateMany(
    { sdcID: targetSdcID }, // Only when matched
    { $set: { sdcID: hemantoSdcID } } // Update
  );

  return result;
};

// Find by contentID and update that link with provided data
LinkSchema.statics.updateALinkWithContentID = async function (
  contentID,
  updatedLinkData
) {
  // Locate the link(s) using your existing finder
  const link = await this.getByContentID(contentID);
  if (!link) {
    throw new Error("No link matched with the provided ID.");
  }

  // Validate every id if they have a corresponding entity
  // See if provided fdc is valid
  if (updatedLinkData.fdcID) {
    const existingFdc = await FirstDegreeCreator.getFdcByID(
      updatedLinkData.fdcID
    );
    if (!existingFdc) {
      throw new Error("No fdc matched with the provided fdcID.");
    }
  }

  // See if provided sdc is valid
  if (updatedLinkData.sdcID) {
    const existingFdc = await SecondDegreeCreator.getSdcByID(
      updatedLinkData.sdcID
    );
    if (!existingFdc) {
      throw new Error("No sdc matched with the provided sdcID.");
    }
  }

  // See if provided employeeID is valid
  if (updatedLinkData.employeeID) {
    const existingFdc = await Employee.getEmployeeByID(
      updatedLinkData.employeeID
    );
    if (!existingFdc) {
      throw new Error("No employee matched with the provided employeeID.");
    }
  }

  // Update the link
  Object.assign(link, updatedLinkData);

  // Finally save the link
  return await link.save();
};

const Link = mongoose.model("Link", LinkSchema, "link");

module.exports = Link;
