// This file checks whether the creator being modified is either updated by its original uploader or by a root admin

const Employee = require("../models/Employee");
const FirstDegreeCreator = require("../models/FirstDegreeCreator");
const SecondDegreeCreator = require("../models/SecondDegreeCreator");
const Link = require("../models/Link");
const {
  temporaryAllowanceCheck,
} = require("../helpers/temporaryAllowanceCheck");
const { getErrorObj } = require("../helpers/getErrorObj");

// Module Scaffolding
const creatorAccess = {};

// This function checks if an employee has modification permission on a creator information
creatorAccess.fdcModificationAccessVerify = async function (req, res, next) {
  // Retrieve the employee
  const loggedEmployee = await Employee.getEmployeeByID(req.user.ID);

  //If no employee found
  if (!loggedEmployee) {
    return next(
      getErrorObj("You do not have permission to access this portal!", 401)
    );
  }

  // Retrieve the fdcID
  const { fdcID } = req.params;

  // Get the FDC associated the ID
  const fdc = await FirstDegreeCreator.getFdcByID(fdcID);

  // If no FDC found
  if (!fdc) {
    return next(getErrorObj("No FDC found with the provided fdcID", 400));
  }

  // If logged in employee is a Root Admin we call next middleware
  if (
    loggedEmployee.employeeType === "ra" &&
    loggedEmployee.department.includes("*")
  ) {
    return next();
  }

  // If Fdc was not uploaded by the logged-in employee, access is denied
  if (loggedEmployee.employeeID !== fdc.uploaderEmployeeID) {
    return next(
      getErrorObj(
        "You do not have permission to modify/delete this creator information",
        401
      )
    );
  }

  // If any employee other than the uploader is using the FDC they need approval to perform any modification
  const fdcLinks = await Link.findByAllIds({ fdcID });

  // Check if at-least one employee other than the uploader is using the fdcID
  if (fdcLinks.some((link) => link.employeeID !== req.user.ID)) {
    const ok = await temporaryAllowanceCheck(req, res);
    if (!ok) {
      return next(
        getErrorObj(
          "Updating this FDC requires admin approval, please contact you Administrator!"
        )
      );
    }
  }

  return next();
};

// This function checks if an employee has modification permission on a creator information
creatorAccess.sdcModificationAccessVerify = async function (req, res, next) {
  // Retrieve the employee
  const loggedEmployee = await Employee.getEmployeeByID(req.user.ID);
  //If no employee found
  if (!loggedEmployee) {
    return next(
      getErrorObj("You do not have permission to access this portal!", 401)
    );
  }

  // Retrieve the sdcID
  const { sdcID } = req.params;

  // Get the SDC associated the ID
  const sdc = await SecondDegreeCreator.getSdcByID(sdcID);

  // If no SDC found
  if (!sdc) {
    return next(getErrorObj("No SDC found with the provided sdcID", 401));
  }

  // If logged in employee is a Root Admin we call next middleware
  if (
    loggedEmployee.employeeType === "ra" &&
    loggedEmployee.department.includes("*")
  ) {
    return next();
  }

  // If Sdc was not uploaded by the logged-in employee, access is denied
  if (loggedEmployee.employeeID !== sdc.uploaderEmployeeID) {
    return next(
      getErrorObj(
        "You do not have permission to modify/delete this creator information",
        401
      )
    );
  }


    // If any employee other than the uploader is using the FDC they need approval to perform any modification
  const sdcLinks = await Link.findByAllIds({ sdcID });

  // Check if at-least one employee other than the uploader is using the fdcID
  if (sdcLinks.some((link) => link.employeeID !== req.user.ID)) {
    const ok = await temporaryAllowanceCheck(req, res);
    if (!ok) {
      return next(
        getErrorObj(
          "Updating this SDC requires admin approval, please contact you Administrator!"
        )
      );
    }
  }

  return next();
};

module.exports = creatorAccess;
