// This file contains all the routes for managing Fdcs

// Imports
const express = require("express");
const manageFdcRouter = express.Router();
const manageFdcController = require("../../controllers/employee/manageFdcController");
const verifyReqBody = require("../../middlewares/verifyReqBody");
const { validationHandler } = require("../../middlewares/validationHandler");
const {
  fdcModificationAccessVerify,
} = require("../../middlewares/verifyEmployeeAccessOnCreators");
const roleVerify = require("../../middlewares/roleVerification");
const getRegexForID = require("../../helpers/getRegexForID");

// Controller files for the path "/"
manageFdcRouter
  .route("/")
  // Get all the Fdcs
  .get(manageFdcController.getAllFdc)
  // Manually add an Fdc
  // Only a root admin can add an Fdc manually
  .post(
    // Check for root admin
    roleVerify.isRootAdmin,
    // Verify the request body
    verifyReqBody,
    // Validate the posted fields
    validationHandler(),
    // Add an Fdc
    manageFdcController.addAnFdc
  );

manageFdcRouter
  .route(`/:fdcID${getRegexForID("fdc_", 12)}`)
  // Get an FDC with fdcID
  .get(manageFdcController.getAnFdc)
  // Patch an FDC
  .patch(
    // Check if the employee has modification access
    fdcModificationAccessVerify,
    // Verify the request body
    verifyReqBody,
    // Validate the posted fields
    validationHandler(),
    // Update an FDC information
    manageFdcController.updateAnFdc
  )
  .delete(
    // Only a Root admin can delete an FDC and their content
    roleVerify.isRootAdmin,
    // delete an FDC and their content
    manageFdcController.deleteAnFdcAndTheirContent
  );

// Export the router
module.exports = { manageFdcRouter };
