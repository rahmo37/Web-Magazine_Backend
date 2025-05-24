// This file manages althe SDC operations

// Imports
const SecondDegreeCreator = require("../../models/SecondDegreeCreator");
const Link = require("../../models/Link");
const { sendRequest } = require("../../helpers/sendRequest");
const { getErrorObj } = require("../../helpers/getErrorObj");
const structureChecker = require("../../helpers/structureChecker");
const flattenObject = require("../../helpers/flattenObject");
const { default: mongoose } = require("mongoose");
const { generateID } = require("../../helpers/generateID");
const { manualMaintenance } = require("../../helpers/scheduledTasks");
const generateImageUrlAndFormat = require("../../helpers/generateImageUrlAndFormat");

// Module Scaffolding
const manageSdc = {};

// This function retrieves all the SDCs
manageSdc.getAllSdc = async function (req, res, next) {
  try {
    // Make a request to get all the current SDCs
    let allSdcs = (await SecondDegreeCreator.getAllSDCs()).map((eachSdc) =>
      eachSdc.toObject()
    );

    // If no SDCs found
    if (!allSdcs) {
      return next(getErrorObj("No SDCs found in the repository!"));
    }

    // Generate signedUrl and format
    allSdcs = await Promise.all(
      allSdcs.map(async (eachSdc) => {
        eachSdc.creatorImage = await generateImageUrlAndFormat(
          eachSdc.creatorImage
        );
        return eachSdc;
      })
    );

    // Send the request and attach all SDCs
    sendRequest({
      res,
      statusCode: 200,
      length: allSdcs.length,
      message: "All SDC information attached",
      data: allSdcs,
    });
  } catch (error) {
    return next(error);
  }
};

// This controller function retrieves an SDC
manageSdc.getAnSdc = async function (req, res, next) {
  try {
    // Retrieve the sdcID
    const { sdcID } = req.params;
    console.log(req.params);

    // Retrieve the SDC
    const retrievedSdc = (
      await SecondDegreeCreator.getSdcByID(sdcID)
    )?.toObject();

    // If SDC not found
    if (!retrievedSdc) {
      return next(getErrorObj("No SDCs found with the provided ID"));
    }

    // Get signedUrl and format the image
    retrievedSdc.creatorImage = await generateImageUrlAndFormat(
      retrievedSdc.creatorImage
    );

    // Send the request and attach the SDC
    sendRequest({
      res,
      statusCode: 200,
      message: "Requested SDC information attached",
      data: retrievedSdc,
    });
  } catch (error) {
    return next(error);
  }
};

// This function creates a new SDC
manageSdc.addAnSdc = async function (req, res, next) {
  try {
    // Get the logged in user's ID. The Sdc will be added to the database under the logged-in employee
    const loggedInEmployeeID = req.user.ID;

    // Extract the body
    const body = { ...req.body };

    // Check the structure of the information provided
    const passedInSdcInfo = flattenObject(body); // Flattening the passed in SDC data
    const sdcKeys = SecondDegreeCreator.getKeys(); // Retrieving keys from the SDC model
    const providedKeys = Object.keys(passedInSdcInfo); // From the passed in SDC info
    const optionalFields = ["creatorImage"];
    if (!structureChecker(sdcKeys, providedKeys, optionalFields)) {
      return next(
        getErrorObj(
          `SDC information is either missing or contains invalid keys. Please review your submission and try again. The required keys are: ${sdcKeys.join(
            ", "
          )}.`,
          400
        )
      );
    }

    // If no images provided, we use the default user image
    if (!passedInSdcInfo.creatorImage) {
      passedInSdcInfo.creatorImage = process.env.DEFAULT_USER_FILENAME;
    }

    // After validation of the structure
    // Generate a new sdcID
    const sdcID = generateID("sdc_");
    stagedSdc = {
      ...passedInSdcInfo,
      sdcID,
      uploaderEmployeeID: loggedInEmployeeID,
    };

    // Now Create the SDC
    const newSdc = await SecondDegreeCreator.createNewSDC(stagedSdc);

    // If successfully created send success the request
    if (newSdc) {
      sendRequest({
        res,
        statusCode: 201,
        message: "New Sdc created successfully",
        data: newSdc,
      });
    } else {
      return next(getErrorObj(`Unable to create an Sdc at this time`));
    }
  } catch (error) {
    return next(error);
  }
};

// This function Update an SDC
manageSdc.updateAnSdc = async function (req, res, next) {
  try {
    // Retrieve the sdcID
    const { sdcID } = req.params;

    // Copy the body
    const body = { ...req.body };

    // Check the structure of the information provide
    const passedInSdcInfo = flattenObject(body); // Flattening the passed in SDC data
    const providedKeys = Object.keys(passedInSdcInfo); // From the passed in SDC info
    const optionalFields = ["creatorName", "creatorBio", "creatorImage"];

    if (!structureChecker([], providedKeys, optionalFields)) {
      return next(
        getErrorObj(
          `SDC information is either missing or contains invalid keys. Please review your submission and try again. At least one key is required. The keys are: ${optionalFields.join(
            ", "
          )}.`,
          400
        )
      );
    }

    // Now update the Sdc
    const updatedSdc = await SecondDegreeCreator.updateAnSdc(sdcID, body);

    // If Update failed
    if (!updatedSdc) {
      return next(getErrorObj());
    }

    // Send the request and attach the SDC
    sendRequest({
      res,
      statusCode: 200,
      message: "Successfully Updated Sdc",
      data: updatedSdc,
    });
  } catch (error) {
    return next(error);
  }
};

// This function Deletes an SDC
manageSdc.deleteAnSdcAndTheirContent = async function (req, res, next) {
  // Start the session
  const session = await mongoose.startSession();

  try {
    let linkDeletion = null;
    let sdcDeletion = null;

    // Retrieve the ID
    const { sdcID } = req.params;

    // We perform the operations with transaction
    await session.withTransaction(async () => {
      linkDeletion = await Link.deleteManyWithID(`sdcID`, sdcID, session);
      sdcDeletion = await SecondDegreeCreator.deleteBySdcID(sdcID, session);
    });

    if (linkDeletion && sdcDeletion) {
      // Send the request and attach the SDC
      sendRequest({
        res,
        statusCode: 200,
        message: "Successfully deleted the sdc and their content",
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
module.exports = manageSdc;
