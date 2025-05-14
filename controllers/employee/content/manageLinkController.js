// This file contains all the logic for updating a content's link

// Imports
const Link = require("../../../models/Link");
const structureChecker = require("../../../helpers/structureChecker");
const deepCopy = require("../../../helpers/deepCopy");
const flattenObject = require("../../../helpers/flattenObject");
const { getErrorObj } = require("../../../helpers/getErrorObj");
const { sendRequest } = require("../../../helpers/sendRequest");

// Module scaffolding
const manageLink = {};

// This function updates a contents link
manageLink.updateContentLink = async function (req, res, next) {
  try {
    // Extract the contentID
    const { contentID } = req.params;

    // Locate the link
    const link = await Link.getByContentID(contentID);
    if (!link) {
      return next(getErrorObj("No link found with the provided contentID"));
    }

    // Link Data
    const linkData = deepCopy(req.body);

    // Check the structure of the request
    const providedKeys = Object.keys(flattenObject(linkData));
    const optionalFields = ["employeeID", "fdcID", "sdcID", "contentStatus"];
    if (!structureChecker([], providedKeys, optionalFields)) {
      return next(
        getErrorObj(
          `Link information provided is either missing or contains invalid keys. Please review your submission and try again. At least one key is required. The required keys are: ${optionalFields.join(
            ", "
          )}`,
          400
        )
      );
    }

    // Retrieve the logged-in user
    const loggedInEmployee = req.user;
    // Check if the employee has full access
    const hasFullAccess = checkAccess(loggedInEmployee);

    // Convert the content status to lowercase
    linkData.contentStatus &&= linkData.contentStatus.toLowerCase();

    // Check if the employee is not an admin but has more than one property in the body, and it is set to pending. Additionally they can only set it to pending if the content is in editing phase
    if (!hasFullAccess) {
      if (
        Object.keys(linkData).length !== 1 ||
        linkData.contentStatus !== "pending" ||
        link.contentStatus === "ready" ||
        link.contentStatus === "pending"
      ) {
        return next(
          getErrorObj(
            `You can only update the contentStatus to 'pending'. Note: you cannot set it to 'pending' if it's already in 'pending' or 'ready' phase.`,
            400
          )
        );
      }
    }

    // Now perform the updated
    const updatedLink = await Link.updateALinkWithContentID(
      contentID,
      linkData
    );

    sendRequest({
      res,
      statusCode: 200,
      message: "Link updated successfully",
      data: updatedLink,
    });
  } catch (error) {
    return next(error);
  }
};

manageLink.updateToHemantoFdc = async function (req, res, next) {
  try {
    // Retrieve the fdcID
    const { fdcID } = req.params;

    // Make the update
    const updateCount = await Link.updateFdcIDWhenSdcIsNull(fdcID);

    // If modified count is 0
    if (updateCount.modifiedCount === 0) {
      return next(
        getErrorObj(
          "Update failed: every content item for this FDC has an associated SDC"
        )
      );
    }

    // Send the request
    sendRequest({
      res,
      statusCode: 200,
      message:
        "Provided FdcID's corresponding links are updated to HemantoFdcID",
      data: updateCount.modifiedCount,
    });
  } catch (error) {
    return next(error);
  }
};

manageLink.updateToHemantoSdc = async function (req, res, next) {
  try {
    // Retrieve the sdcID
    const { sdcID } = req.params;

    // Make the update
    const updateCount = await Link.updateSdcIDToHemantoID(sdcID);

    // If modified count is 0
    if (updateCount.modifiedCount === 0) {
      return next(getErrorObj());
    }

    // Send the request
    sendRequest({
      res,
      statusCode: 200,
      message:
        "Provided SdcID's corresponding links are updated to HemantoSdcID",
      data: updateCount.modifiedCount,
    });
  } catch (error) {
    return next(error);
  }
};

// Helper functions
function checkAccess(user) {
  return user.employeeType === "ra" || user.employeeType === "da"
    ? true
    : false;
}

// Export the module
module.exports = manageLink;
