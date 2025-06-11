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
const generateImageUrlAndFormat = require("../../helpers/generateImageUrlAndFormat");
const rollbackOnUploadFailure = require("../../helpers/rollbackOnUploadFailure");
const UploadTracker = require("../../models/UploadTracker");

// Module Scaffolding
const manageFdc = {};

// This function return all the fdcs
manageFdc.getAllFdc = async function (req, res, next) {
  try {
    // Make a request to get all the current FDCs
    let allFdcs = (await FirstDegreeCreator.getAllFDCs()).map((eachFdc) =>
      eachFdc.toObject()
    );

    // If no FDCs found
    if (!allFdcs) {
      return next(getErrorObj("No FDCs found in the repository!"));
    }

    // Generate signedUrl and format
    allFdcs = await Promise.all(
      allFdcs.map(async (eachFdc) => {
        eachFdc.creatorImage = await generateImageUrlAndFormat(
          eachFdc.creatorImage
        );
        return eachFdc;
      })
    );

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

// This function retrieves an FDC with a provided fdcID ID
manageFdc.getAnFdc = async function (req, res, next) {
  try {
    // Retrieve the fdcID
    const { fdcID } = req.params;
    console.log(req.params);

    // Retrieve the FDC
    const retrievedFdc = (
      await FirstDegreeCreator.getFdcByID(fdcID)
    )?.toObject();

    // If FDC not found
    if (!retrievedFdc) {
      return next(getErrorObj("No FDCs found with the provided ID"));
    }
    // Get signedUrl and format the image
    retrievedFdc.creatorImage = await generateImageUrlAndFormat(
      retrievedFdc.creatorImage
    );

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
    if (!req.tracker) {
      return next(
        getErrorObj(
          "Unable to create/find the tracker. Please ensure the upID is sent with the request body",
          400
        )
      );
    }

    // The tracker instance for this FDC
    const tracker = { ...req.tracker };

    // Retrieve the files in tracker
    const filesInTracker = new Set([...tracker.fileNames]);

    // Get the logged in user's ID. The Fdc will be added to the database under the logged-in employee
    const loggedInEmployeeID = req.user.ID;

    // Extract the body
    const body = { ...req.body };

    // Check the structure of the information provided
    const passedInFdcInfo = flattenObject(body); // Flattening the passed in FDC data
    const fdcKeys = FirstDegreeCreator.getKeys(); // Retrieving keys from the FDC model
    if (!fdcKeys.includes("upID")) fdcKeys.push("upID");
    const providedKeys = Object.keys(passedInFdcInfo); // From the passed in FDC info
    const optionalFields = ["creatorImage"];
    if (!structureChecker(fdcKeys, providedKeys, optionalFields)) {
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
    //  Process image uploads
    if (
      passedInFdcInfo.creatorImage &&
      passedInFdcInfo.creatorImage !== process.env.DEFAULT_USER_FILENAME
    ) {
      // If the creator image is not in the fileTracker
      if (!filesInTracker.has(passedInFdcInfo.creatorImage)) {
        return next(
          getErrorObj(
            `The image file name provided for the FDC creatorImage does not match any file in the upload tracker. Please ensure the creatorImage file name corresponds to one of the uploaded files`,
            400
          )
        );
      }

      // If there are multiple or zero images in the tracker
      if (filesInTracker.size !== 1) {
        return next(
          getErrorObj(
            `Inconsistency detected in the tracker: When creating an FDC, the server expects exactly one image to be uploaded. However, found ${filesInTracker.size} image(s) in the tracker. Please ensure that one and only one image is provided for a successful FDC creation.`,
            400
          )
        );
      }
    } else {
      // If files detected in tracker, even if there was no creator image
      if (filesInTracker.size !== 0) {
        return next(
          getErrorObj(
            `Inconsistency detected in the tracker: No creator images was provided, however fileTracker contains image(s)`,
            400
          )
        );
      }

      // If no images provided, we use the default user image
      passedInFdcInfo.creatorImage = process.env.DEFAULT_USER_FILENAME;
    }

    // Generate a new fdcID
    const fdcID = generateID("fdc_");
    const stagedFdc = {
      ...passedInFdcInfo,
      fdcID,
      uploaderEmployeeID: loggedInEmployeeID,
    };

    // Now Create the FDC
    const newFdc = await FirstDegreeCreator.createNewFDC(stagedFdc);

    // If successfully created send success message
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
    const body = flattenObject({ ...req.body });

    // Optional Fields
    const optionalFields = ["creatorName", "creatorBio", "creatorImage"];

    // Extract the keys from provided info
    const providedKeys = Object.keys(body);

    // Check the structure of the request against the FDC keys
    if (!structureChecker([], providedKeys, optionalFields)) {
      return next(
        getErrorObj(
          `FDC information missing or invalid keys provided. Required keys (at least one): ${optionalFields.join(
            ", "
          )}.`,
          400
        )
      );
    }

    // Get the fdc
    const fdc = await FirstDegreeCreator.getFdcByID(fdcID);

    // If the fdc is not found
    if (!fdc) {
      return next(getErrorObj(`No FDC found with provided ID.`, 400));
    }

    // If tracker is attached we retrieve the tracker, otherwise we get the tracker using the fdc.upID
    const tracker =
      req.tracker ?? (fdc.upID && (await UploadTracker.getTracker(fdc.upID)));

    // If no tracker is found we return error
    if (!tracker) {
      return next(
        getErrorObj(`No upload tracker found for this fdc!`, 400)
      );
    }

    // Tracker files becomes a set from array for faster look-up
    const filesInTrackerSet = new Set(tracker.fileNames);

    // This will contain the images that needs to be delete
    let imagesToDelete = [];

    // If the creator image is not provided for update, we check if there are any files uploaded
    if (!body.creatorImage) {
      const wrappedCreatorImage =
        fdc.creatorImage !== process.env.DEFAULT_USER_FILENAME
          ? [fdc.creatorImage]
          : [];
      // Then check the current images integrity
      if (!structureChecker(wrappedCreatorImage, [...filesInTrackerSet])) {
        return next(
          getErrorObj("Images were uploaded, but no creatorImage provided", 400)
        );
      }
    } else {
      //  See if the provided creator image is uploaded and in the filesTracker
      if (!filesInTrackerSet.has(body.creatorImage)) {
        return next(
          getErrorObj(
            `Provided creatorImage filename not found in tracker.`,
            400
          )
        );
      }

      // Grab the current image to delete
      if (fdc.creatorImage !== process.env.DEFAULT_USER_FILENAME) {
        imagesToDelete.push(fdc.creatorImage);
      }
    }

    //  Now update the Fdc
    const updatedFdc = await FirstDegreeCreator.updateAnFdc(fdcID, body);
    if (!updatedFdc) {
      return next(getErrorObj(`FDC update operation failed.`, 500));
    }

    //  Send the request
    sendRequest({
      res,
      statusCode: 200,
      message: "Successfully updated FDC.",
      data: updatedFdc,
    });

    // Finally delete the images if any
    if (imagesToDelete.length > 0) {
      setImmediate(async () => {
        try {
          // Delete any images from the tracker
          const result = await rollbackOnUploadFailure(
            fdc.upID,
            imagesToDelete,
            false
          );
          console.log(result);
        } catch (error) {
          console.error("Image and tracker deletion failed", error);
        }
      });
    }
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
    let deletedFdc = null;

    // Retrieve the ID
    const { fdcID } = req.params;

    // We perform the operations with transaction
    await session.withTransaction(async () => {
      linkDeletion = await Link.deleteManyWithID(`fdcID`, fdcID, session);
      deletedFdc = await FirstDegreeCreator.deleteByFdcID(fdcID, session);
    });

    if (linkDeletion && deletedFdc) {
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
          // Delete any images and trackers
          const result = await rollbackOnUploadFailure(
            deletedFdc.upID,
            null,
            true
          );
          console.log(result);

          // Delete any contents if they had, asynchronously
          await manualMaintenance();
        } catch (error) {
          console.error(
            "Image and tracker deletion, or the Maintenance task failed:",
            error
          );
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
