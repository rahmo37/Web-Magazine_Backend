// This file contains all the routes for managing a link

// Imports
const express = require("express");
const manageLinkRouter = express.Router();
const manageLinkController = require("../../../controllers/employee/content/manageLinkController");
const {
  routeAccessVerify,
} = require("../../../middlewares/verifyEmployeeAccessOnDepartments");
const validateDepartmentParam = require("../../../middlewares/validateDepartmentParam");
const verifyReqBody = require("../../../middlewares/verifyReqBody");
const { validationHandler } = require("../../../middlewares/validationHandler");
const { isRootAdmin } = require("../../../middlewares/roleVerification");
const getRegexForID = require("../../../helpers/getRegexForID");

// Update a content link
manageLinkRouter.patch(
  "/:department/:contentID",
  // Validate department param
  validateDepartmentParam,
  // Only root admin and department admin can access
  // routeAccessVerify(null, true),
  // Verify the body
  verifyReqBody,
  // Validate the IDs
  validationHandler(),
  // Now we update the content link
  manageLinkController.updateContentLink
);

// Update all given fdc ID's link to hemanto's fdc if corresponding link has no sdc
manageLinkRouter.patch(
  `/:fdcID${getRegexForID("fdc_", 12)}`,
  // Only root admin is allowed
  isRootAdmin,
  // Update to hemanto fdc
  manageLinkController.updateToHemantoFdc
);


// Update all given sdcID's link to hemanto's sdc
manageLinkRouter.patch(
  `/:sdcID${getRegexForID("sdc_", 12)}`,
  // Only root admin is allowed
  isRootAdmin,
  // Update to hemanto fdc
  manageLinkController.updateToHemantoSdc
);

// Export the module
module.exports = { manageLinkRouter };
