// This file checks if the department query sting is valid ann if the ID passed-in is within that department

// Valid Departments from the environment variable
const validDepartments = process.env.DEPARTMENTS.split(",");
const validDepartmentIDPrefix = JSON.parse(process.env.DEPARTMENT_IDPREFIX);
const { getErrorObj } = require("../helpers/getErrorObj");

// Middleware to validate department param
const validateDepartmentParam = (req, res, next) => {
  // Extract the department
  let { department } = req.params;
  department = department.toLowerCase();

  // Check if the department is valid
  if (!validDepartments.includes(department)) {
    return next(getErrorObj("Invalid department specified"));
  }

  // Additionally check the ID as well
  if (req.params?.contentID) {
    if (!req.params.contentID.startsWith(validDepartmentIDPrefix[department])) {
      return next(
        getErrorObj(
          `Invalid contentID provided for the department: ${department}`
        )
      );
    }
  }

  next();
};

module.exports = validateDepartmentParam;
