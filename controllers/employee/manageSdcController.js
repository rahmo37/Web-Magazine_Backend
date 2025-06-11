// This file manages all the SDC operations

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
const rollbackOnUploadFailure = require("../../helpers/rollbackOnUploadFailure");
const UploadTracker = require("../../models/UploadTracker");

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
    if (!req.tracker) {
      return next(
        getErrorObj(
          "Unable to create/find the tracker. Please ensure the upID is sent with the request body",
          400
        )
      );
    }

    // The tracker instance for this SDC
    const tracker = { ...req.tracker };

    // Retrieve the files in tracker
    const filesInTracker = new Set([...tracker.fileNames]);

    // Get the logged in user's ID. The Sdc will be added to the database under the logged-in employee
    const loggedInEmployeeID = req.user.ID;

    // Extract the body
    const body = { ...req.body };

    // Check the structure of the information provided
    const passedInSdcInfo = flattenObject(body); // Flattening the passed in SDC data
    const sdcKeys = SecondDegreeCreator.getKeys(); // Retrieving keys from the SDC model
    if (!sdcKeys.includes("upID")) sdcKeys.push("upID");
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

    // After validation of the structure
    //  Process image uploads
    if (
      passedInSdcInfo.creatorImage &&
      passedInSdcInfo.creatorImage !== process.env.DEFAULT_USER_FILENAME
    ) {
      // If the creator image is not in the fileTracker
      if (!filesInTracker.has(passedInSdcInfo.creatorImage)) {
        return next(
          getErrorObj(
            `The image file name provided for the SDC creatorImage does not match any file in the upload tracker. Please ensure the creatorImage file name corresponds to one of the uploaded files`,
            400
          )
        );
      }

      // If there are multiple or zero images in the tracker
      if (filesInTracker.size !== 1) {
        return next(
          getErrorObj(
            `Inconsistency detected in the tracker: When creating an SDC, the server expects exactly one image to be uploaded. However, found ${filesInTracker.size} image(s) in the tracker. Please ensure that one and only one image is provided for a successful SDC creation.`,
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
      passedInSdcInfo.creatorImage = process.env.DEFAULT_USER_FILENAME;
    }

    // Generate a new sdcID
    const sdcID = generateID("sdc_");
    const stagedSdc = {
      ...passedInSdcInfo,
      sdcID,
      uploaderEmployeeID: loggedInEmployeeID,
    };

    // Now Create the SDC
    const newSdc = await SecondDegreeCreator.createNewSDC(stagedSdc);

    // If successfully created send success message
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

    // Optional Fields
    const optionalFields = ["creatorName", "creatorBio", "creatorImage"];

    // Extract the keys from provided info
    const providedKeys = Object.keys(body);

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

    // Get the sdc
    const sdc = await SecondDegreeCreator.getSdcByID(sdcID);

    // If the sdc is not found
    if (!sdc) {
      return next(getErrorObj(`No SDC found with provided ID.`, 400));
    }

    // If tracker is attached we retrieve the tracker, otherwise we get the tracker using the sdc.upID
    const tracker =
      req.tracker ?? (sdc.upID && (await UploadTracker.getTracker(sdc.upID)));

    // If no tracker is found we return error
    if (!tracker) {
      return next(getErrorObj(`No upload tracker found for this sdc!`, 400));
    }

    // This will contain the images that needs to be delete
    let imagesToDelete = [];

    // Tracker files becomes a set from array for faster look-up
    const filesInTrackerSet = new Set(tracker.fileNames);

    // If the creator image is not provided for update, we check if there are any files uploaded
    if (!body.creatorImage) {
      const wrappedCreatorImage =
        sdc.creatorImage !== process.env.DEFAULT_USER_FILENAME
          ? [sdc.creatorImage]
          : [];
      // Then check the current images integrity
      if (!structureChecker(wrappedCreatorImage, [...filesInTrackerSet])) {
        return next(
          getErrorObj("Images were uploaded, but no creatorImage provided", 400)
        );
      }
    } else {
      // See if the provided creator image is uploaded and in the filesTracker
      if (!filesInTrackerSet.has(body.creatorImage)) {
        return next(
          getErrorObj(
            `Provided creatorImage filename not found in tracker.`,
            400
          )
        );
      }

      // Grab the current image to delete
      if (sdc.creatorImage !== process.env.DEFAULT_USER_FILENAME) {
        imagesToDelete.push(sdc.creatorImage);
      }
    }

    // Now update the Sdc
    const updatedSdc = await SecondDegreeCreator.updateAnSdc(sdcID, body);

    // If Update failed
    if (!updatedSdc) {
      return next(getErrorObj(`SDC update operation failed.`, 500));
    }

    // Send the request and attach the SDC
    sendRequest({
      res,
      statusCode: 200,
      message: "Successfully Updated Sdc",
      data: updatedSdc,
    });

    // Finally delete the images if any
    if (imagesToDelete.length > 0) {
      setImmediate(async () => {
        try {
          // Delete any images from the tracker
          const result = await rollbackOnUploadFailure(
            sdc.upID,
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

// This function Deletes an SDC
manageSdc.deleteAnSdcAndTheirContent = async function (req, res, next) {
  // Start the session
  const session = await mongoose.startSession();

  try {
    let linkDeletion = null;
    let deletedSdc = null;

    // Retrieve the ID
    const { sdcID } = req.params;

    // We perform the operations with transaction
    await session.withTransaction(async () => {
      linkDeletion = await Link.deleteManyWithID(`sdcID`, sdcID, session);
      deletedSdc = await SecondDegreeCreator.deleteBySdcID(sdcID, session);
    });

    if (linkDeletion && deletedSdc) {
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
          // Delete any images and trackers
          const result = await rollbackOnUploadFailure(
            deletedSdc.upID,
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
module.exports = manageSdc;
