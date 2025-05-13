// This file manages all the FDC operations
// Imports
const FirstDegreeCreator = require("../../models/FirstDegreeCreator");
const Link = require("../../models/Link");
const { sendRequest } = require("../../helpers/sendRequest");
const { getErrorObj } = require("../../helpers/getErrorObj");
const structureChecker = require("../../helpers/structureChecker");
const flattenObject = require("../../helpers/flattenObject");
const { default: mongoose } = require("mongoose");
const { generateID } = require("../../helpers/generateID");
const { manualMaintenance } = require("../../helpers/scheduledTasks");

// Module Scaffolding
const manageFdc = {};

// This function return all the fdcs
manageFdc.getAllFdc = async function (req, res, next) {
  try {
    // Make a request to get all the current FDCs
    const allFdcs = await FirstDegreeCreator.getAllFDCs();

    // If no FDCs found
    if (!allFdcs) {
      return next(getErrorObj("No FDCs found in the repository!"));
    }

    // Send the request and attach all FDCs
    sendRequest({
      res,
      statusCode: 200,
      length: allFdcs.length,
      message: "All FDC information attached",
      data: allFdcs,
    });
  } catch (error) {
    return next(error);
  }
};

// This function retrieves an FDC with a protvided fdcID ID
manageFdc.getAnFdc = async function (req, res, next) {
  try {
    // Retrieve the fdcID
    const { fdcID } = req.params;
    console.log(req.params);

    // Retrieve the FDC
    const retrievedFdc = await FirstDegreeCreator.getFdcByID(fdcID);

    // If FDC not found
    if (!retrievedFdc) {
      return next(getErrorObj("No FDCs found with the provided ID"));
    }

    // Send the request and attach the FDC
    sendRequest({
      res,
      statusCode: 200,
      message: "Requested FDC information attached",
      data: retrievedFdc,
    });
  } catch (error) {
    return next(error);
  }
};

// This function will create an Fdc
manageFdc.addAnFdc = async function (req, res, next) {
  try {
    // Get the logged in user's ID. The Fdc will be added to the database under the logged-in employee
    const loggedInEmployeeID = req.user.ID;

    // Extract the body
    const body = { ...req.body };

    // Check the structure of the information provided
    const passedInFdcInfo = flattenObject(body); // Flattening the passed in FDC data
    const fdcKeys = FirstDegreeCreator.getKeys(); // Retrieving keys from the FDC model
    const providedKeys = Object.keys(passedInFdcInfo); // From the passed in FDC info
    if (!structureChecker(fdcKeys, providedKeys)) {
      return next(
        getErrorObj(
          `FDC information is either missing or contains invalid keys. Please review your submission and try again. The required keys are: ${fdcKeys.join(
            ", "
          )}.`,
          400
        )
      );
    }

    // After validation of the structure
    // Generate a new fdcID
    const fdcID = generateID("fdc_");
    stagedFdc = {
      ...passedInFdcInfo,
      fdcID,
      uploaderEmployeeID: loggedInEmployeeID,
    };

    // Now Create the FDC
    const newFdc = await FirstDegreeCreator.createNewFDC(stagedFdc);

    // If successfully created send success the request
    if (newFdc) {
      sendRequest({
        res,
        statusCode: 201,
        message: "New Fdc created successfully",
        data: newFdc,
      });
    } else {
      return next(getErrorObj(`Unable to create an Fdc at this time`));
    }
  } catch (error) {
    return next(error);
  }
};

// Update an FDC
manageFdc.updateAnFdc = async function (req, res, next) {
  try {
    // Retrieve the fdcID
    const { fdcID } = req.params;

    // Copy the body
    const body = { ...req.body };

    // Check the structure of the information provide
    const passedInFdcInfo = flattenObject(body); // Flattening the passed in FDC data
    const providedKeys = Object.keys(passedInFdcInfo); // From the passed in FDC info
    const optionalFields = ["creatorName", "creatorBio", "creatorImage"];

    if (!structureChecker([], providedKeys, optionalFields)) {
      return next(
        getErrorObj(
          `FDC information is either missing or contains invalid keys. Please review your submission and try again. At least one key is required. The keys are: ${optionalFields.join(
            ", "
          )}.`,
          400
        )
      );
    }

    // Now update the Fdc
    const updatedFdc = await FirstDegreeCreator.updateAnFdc(fdcID, body);

    // If Update failed
    if (!updatedFdc) {
      return next(getErrorObj());
    }

    // Send the request and attach the FDC
    sendRequest({
      res,
      statusCode: 200,
      message: "Successfully Updated Fdc",
      data: updatedFdc,
    });
  } catch (error) {
    return next(error);
  }
};

// Delete an FDC and their content
manageFdc.deleteAnFdcAndTheirContent = async function (req, res, next) {
  // Start the session
  const session = await mongoose.startSession();

  try {
    let linkDeletion = null;
    let fdcDeletion = null;

    // Retrieve the ID
    const { fdcID } = req.params;

    // We perform the operations with transaction
    await session.withTransaction(async () => {
      linkDeletion = await Link.deleteManyWithID(`fdcID`, fdcID, session);
      fdcDeletion = await FirstDegreeCreator.deleteByFdcID(fdcID, session);
    });

    if (linkDeletion && fdcDeletion) {
      // Send the request and attach the FDC
      sendRequest({
        res,
        statusCode: 200,
        message: "Successfully deleted the fdc and their content",
        data: {
          linksDeleted: linkDeletion.deletedCount,
        },
      });

      // Run maintenance asynchronously after response is sent
      setImmediate(async () => {
        try {
          await manualMaintenance();
        } catch (error) {
          console.error("Maintenance task failed:", error);
        }
      });
    } else {
      return next(getErrorObj());
    }
  } catch (error) {
    return next(error);
  } finally {
    session.endSession();
  }
};

// Export the module
module.exports = manageFdc;
