// This file contains all the routes for managing Sdcs

// Import
const express = require("express");
const manageSdcRouter = express.Router();
const manageSdcController = require("../../controllers/employee/manageSdcController");
const verifyReqBody = require("../../middlewares/verifyReqBody");
const { validationHandler } = require("../../middlewares/validationHandler");
const {
  sdcModificationAccessVerify,
} = require("../../middlewares/verifyEmployeeAccessOnCreators");
const roleVerify = require("../../middlewares/roleVerification");
const getRegexForID = require("../../helpers/getRegexForID");
const parseImageMeta = require("../../middlewares/parseImageMeta");
const multerImageInjection = require("../../middlewares/multerImageInjection");
const {
  uploadBatchedImages,
} = require("../../controllers/imageOperationsController");

// Controller files for the path "/"
manageSdcRouter
  .route("/")
  // Get all the Sdcs
  .get(manageSdcController.getAllSdc)
  // Manually add an Sdc
  // Only a root admin can add an Sdc manually
  .post(
    // Check for root admin
    roleVerify.isRootAdmin,
    // If any images in the request, multer injects them in the req.files
    multerImageInjection,
    // parse the metadata of the images,
    parseImageMeta,
    // Verify the request body
    // Verify the request body
    verifyReqBody,
    // Validate the posted fields
    validationHandler(),
    // Upload the images in batch
    uploadBatchedImages,
    // Add an Sdc
    manageSdcController.addAnSdc
  );

manageSdcRouter
  .route(`/:sdcID${getRegexForID("sdc_", 12)}`)
  // Get an SDC with sdcID
  .get(manageSdcController.getAnSdc)
  // Patch an SDC
  .patch(
    // Check if the employee has modification access
    sdcModificationAccessVerify,
    // Verify the request body
    // If any images in the request, multer injects them in the req.files
    multerImageInjection,
    // parse the metadata of the images,
    parseImageMeta,
    // Verify the request body
    verifyReqBody,
    // Validate the posted fields
    validationHandler(),
    // Upload the images in batch
    uploadBatchedImages,
    // Update an FDC information
    manageSdcController.updateAnSdc
  )
  .delete(
    // Only a Root admin can delete an FDC and their content
    roleVerify.isRootAdmin,
    // delete an FDC and their content
    manageSdcController.deleteAnSdcAndTheirContent
  );

module.exports = { manageSdcRouter };
