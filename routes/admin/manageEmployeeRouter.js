// This file contains all the routes for managing employees

// Imports
const express = require("express");
const manageEmployeeRouter = express.Router();
const { validationHandler } = require("../../middlewares/validationHandler");
const manageEmployeeController = require("../../controllers/admin/manageEmployeeController");
const roleVerify = require("../../middlewares/roleVerification");
const verifyReqBody = require("../../middlewares/verifyReqBody");
const temporaryEndpointDisable = require("../../middlewares/temporaryEndpointDisable");
const parseImageMeta = require("../../middlewares/parseImageMeta");
const multerImageInjection = require("../../middlewares/multerImageInjection");
const {
  uploadBatchedImages,
} = require("../../controllers/imageOperationsController");

// Get all employees
manageEmployeeRouter.get("/", manageEmployeeController.getAllEmployees);

// Only Root Admins are allowed
manageEmployeeRouter.use(roleVerify.isRootAdmin);

// Request to '/' url
manageEmployeeRouter
  .route("/")
  // Create an employee
  .post(
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
    // Add an employee
    manageEmployeeController.addEmployee
  );

// Request to "/:ID"
manageEmployeeRouter
  .route("/:ID(emp_[A-Za-z0-9]{6})")
  // Get an employee
  .get(manageEmployeeController.getAnEmployee)
  // Update an employee
  .patch(
    verifyReqBody,
    validationHandler(),
    manageEmployeeController.updateAnEmployee
  )
  // Delete an employee
  .delete(temporaryEndpointDisable, manageEmployeeController.deleteAnEmployee);

module.exports = { manageEmployeeRouter };
