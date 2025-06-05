// This module has all the controller logics for managing employees

// Importing necessary modules
const Employee = require("../../models/Employee");
const flattenObject = require("../../helpers/flattenObject");
const structureChecker = require("../../helpers/structureChecker");
const { getErrorObj } = require("../../helpers/getErrorObj");
const { sendRequest } = require("../../helpers/sendRequest");
const { dateAndTime } = require("../../helpers/dateAndTime");
const { generateID } = require("../../helpers/generateID");
const { getHashedPassword } = require("../../helpers/hashPassword");
const generateImageUrlAndFormat = require("../../helpers/generateImageUrlAndFormat");
const rollbackOnUploadFailure = require("../../helpers/rollbackOnUploadFailure");

// Module scaffolding
const manageEmployee = {};

// Get all employee
manageEmployee.getAllEmployees = async (req, res, next) => {
  try {
    // Retrieving all the employees
    let allEmployees = (await Employee.getAllEmployees()).map((eachEmp) =>
      eachEmp.toObject()
    );

    if (!allEmployees || allEmployees.length === 0) {
      return next(
        getErrorObj(`Unable to retrieve employees, or no employees exist`, 404)
      );
    }

    // Generate signedUrl and format
    allEmployees = await Promise.all(
      allEmployees.map(async (eachEmp) => {
        eachEmp.employeePreferences.profilePicture =
          await generateImageUrlAndFormat(
            eachEmp.employeePreferences.profilePicture
          );
        return eachEmp;
      })
    );

    // Send the employee data
    sendRequest({
      res,
      statusCode: 200,
      message: "All employee information attached",
      data: allEmployees,
    });
  } catch (error) {
    next(error);
  }
};

// Get an employee
manageEmployee.getAnEmployee = async (req, res, next) => {
  try {
    // Retrieve the ID
    const { ID } = req.params;

    // If the ID does not start with emp_
    if (!ID.startsWith("emp_")) {
      return next(
        getErrorObj(`ID provided with the request is not valid`, 404)
      );
    }

    // Retrieve the employee
    const employee = (await Employee.getEmployeeByID(ID))?.toObject();

    // If no employee found
    if (!employee) {
      return next(getErrorObj(`No employee found with the provided ID`, 404));
    }

    // Get signedUrl and format the image
    employee.employeePreferences.profilePicture =
      await generateImageUrlAndFormat(
        employee.employeePreferences.profilePicture
      );

    // Now sending the employee info
    sendRequest({
      res,
      statusCode: 200,
      message: "Employee info attached",
      data: employee,
    });
  } catch (error) {
    next(error);
  }
};

// Add an employee
manageEmployee.addEmployee = async (req, res, next) => {
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

    const passedInEmployeeInfo = flattenObject(req.body);
    const employeeKeys = Employee.getKeys();
    const providedKeys = Object.keys(passedInEmployeeInfo);
    const optionalFields = ["profilePicture"];
    if (!structureChecker(employeeKeys, providedKeys, optionalFields)) {
      return next(
        getErrorObj(
          `Employee information is either missing or contains invalid keys. Please review your submission and try again. The required keys are: ${employeeKeys.join(
            ", "
          )}`,
          400
        )
      );
    }

    // After validation of the structure
    //  Process image uploads
    if (
      passedInEmployeeInfo.profilePicture &&
      passedInEmployeeInfo.profilePicture !== process.env.DEFAULT_USER_FILENAME
    ) {
      // If the profilePicture is not in the fileTracker
      if (!filesInTracker.has(passedInEmployeeInfo.profilePicture)) {
        return next(
          getErrorObj(
            `The image file name provided for the Employee ProfilePicture does not match any file in the upload tracker. Please ensure the creatorImage file name corresponds to one of the uploaded files`,
            400
          )
        );
      }

      // If there are multiple or zero images in the tracker
      if (filesInTracker.size !== 1) {
        return next(
          getErrorObj(
            `Inconsistency detected in the tracker: When creating an Employee, the server expects exactly one image to be uploaded for the ProfilePicture. However, found ${filesInTracker.size} image(s) in the tracker. Please ensure that one and only one image is provided for a successful Employee creation.`,
            400
          )
        );
      }
    } else {
      // If files detected in tracker, even if there was no Profile Picture
      if (filesInTracker.size !== 0) {
        return next(
          getErrorObj(
            `Inconsistency detected in the tracker: No profile picture was provided, however fileTracker contains image(s)`,
            400
          )
        );
      }

      // If no images provided, we use the default user image
      passedInEmployeeInfo.profilePicture = process.env.DEFAULT_USER_FILENAME;
    }

    // Destructuring values
    let {
      upID,
      email,
      phone,
      password,
      dateJoined,
      employeeType,
      department,
      deniedDepartment,
      firstName,
      lastName,
      gender,
      profilePicture,
      dateOfBirth,
    } = passedInEmployeeInfo;

    // Check if the employee already exists with the email address provided
    const doesExistsWithEmail = await Employee.getEmployeeByEmail(email);

    // If employee exists with email
    if (doesExistsWithEmail) {
      return next(
        getErrorObj(
          `An employee already exists with the email address provided!`,
          409
        )
      );
    }

    // Check if the employee already exists with the phone number provided
    const doesExistsWithPhone = await Employee.getEmployeeByPhone(phone);

    // If employee exists with phone
    if (doesExistsWithPhone) {
      return next(
        getErrorObj(
          `An employee already exists with the phone number provided!`,
          409
        )
      );
    }

    // If root admin provide full content access
    if (employeeType === "ra") {
      department = ["*"];
      deniedDepartment = [];
    }

    // Make each dept name lowercase
    department = department.map((dept) => dept.toLowerCase());

    // Make each deniedDept name lower case
    deniedDepartment = deniedDepartment.map((dept) => dept.toLowerCase());

    // Creating new employee with values
    const newEmployeeObject = {
      upID,
      email: email.toLowerCase(),
      phone,
      password: await getHashedPassword(password),
      dateJoined,
      employeeType,
      department,
      deniedDepartment,
      employeeBio: { firstName, lastName, gender, dateOfBirth },
      employeePreferences: { profilePicture, themeColor: null },
    };

    // Gathering other necessary information
    newEmployeeObject.temporaryApproval = false;
    newEmployeeObject.lastLogin = null;
    newEmployeeObject.isActiveAccount = true;
    newEmployeeObject.accountCreated = dateAndTime.getUtcRaw();
    newEmployeeObject.employeeID = generateID("emp_", 3);

    // Now create an employee
    const newEmployee = await Employee.createEmployee(newEmployeeObject);

    // If the unable to create employee
    if (!newEmployee) {
      return next(
        getErrorObj(
          "Employee creation failed! Please contact technical support for assistance",
          500
        )
      );
    }

    // Now sending the response with the new employee data
    sendRequest({
      res,
      statusCode: 201,
      message: "New employee created",
      data: newEmployee,
    });
  } catch (error) {
    // Log the message
    console.error(error.message);

    // Send a generic error to the client
    return next(getErrorObj());
  }
};

// Update an employee info
manageEmployee.updateAnEmployee = async (req, res, next) => {
  try {
    // Retrieve the ID
    const { ID } = req.params;

    // If the ID does not start with emp_
    if (!ID.startsWith("emp_")) {
      return next(
        getErrorObj(`ID provided with the request is not valid`, 404)
      );
    }

    // Retrieve the employee
    const employee = await Employee.getEmployeeByID(ID);

    // If no employee found with the provided ID
    if (!employee) {
      return next(getErrorObj(`No employee found with the provided ID`, 404));
    }

    // Now retrieve the update information
    const updateInfo = req.body;

    // Flatten the updated info if provided in a nested structure
    const flattenedUpdateInfo = flattenObject(updateInfo);

    // Convert employee keys to a Set for faster lookup
    const employeeKeysSet = new Set(Employee.getKeys());

    // Add the isActiveAccount and temporaryApproval field manually since the getKeys() does not return isActiveAccount key
    if (ID !== req.user.ID) {
      employeeKeysSet.add("isActiveAccount");
      employeeKeysSet.add("temporaryApproval");
    }

    // Find invalid keys
    const invalidKeys = Object.keys(flattenedUpdateInfo).filter(
      (key) => !employeeKeysSet.has(key)
    );

    // If there are invalid keys, return an error
    if (invalidKeys.length > 0) {
      return next(
        getErrorObj(`Invalid keys found: ${invalidKeys.join(", ")}`, 400)
      );
    }

    // If the employee is an admin
    if (ID !== req.user.ID && employee.employeeType === "ra") {
      return next(
        getErrorObj(`You cannot update another root admin's information`, 400)
      );
    }

    // Hash the password if exists
    if (flattenedUpdateInfo.password) {
      flattenedUpdateInfo.password = await getHashedPassword(
        flattenedUpdateInfo.password
      );
    }

    // If the employee is promoted to root admin, then change the department to * and deniedDepartment to []
    if (
      flattenedUpdateInfo.employeeType &&
      flattenedUpdateInfo.employeeType === "ra"
    ) {
      flattenedUpdateInfo.department = ["*"];
      flattenedUpdateInfo.deniedDepartment = [];
    }

    // if department is being updated ensure all the names are in lowercase
    if (flattenedUpdateInfo.department) {
      flattenedUpdateInfo.department = flattenedUpdateInfo.department.map(
        (dept) => dept.toLowerCase()
      );
    }

    // if denied department is being updated ensure all the names are in lowercase
    if (flattenedUpdateInfo.deniedDepartment) {
      flattenedUpdateInfo.deniedDepartment =
        flattenedUpdateInfo.deniedDepartment.map((dept) => dept.toLowerCase());
    }

    // Update the employee
    const updatedEmployee = await employee.updateAnEmployee(
      flattenedUpdateInfo
    );

    // Convert Mongoose document to a plain object
    const updatedEmployeeObj = updatedEmployee.toObject();

    // Delete the password before sending
    delete updatedEmployeeObj.password;

    // Now sending the response with the new employee data
    sendRequest({
      res,
      statusCode: 200,
      message: "Employee updated",
      data: updatedEmployeeObj,
    });
  } catch (error) {
    next(error);
  }
};

// Delete an employee
manageEmployee.deleteAnEmployee = async (req, res, next) => {
  try {
    // Retrieve the id
    const { ID } = req.params;

    // If the id does not start with emp_
    if (!ID.startsWith("emp_")) {
      return next(
        getErrorObj(`ID provided with the request is not valid`, 404)
      );
    }

    // If the id provide is the same as logged in admin
    if (ID === req.user.ID) {
      return next(
        getErrorObj(
          `You cannot delete your own account through this portal. Please contact your administrator`,
          403
        )
      );
    }

    // Retrieve the employee
    const employee = await Employee.getEmployeeByID(ID);

    // If no employee found with the provided ID
    if (!employee) {
      return next(getErrorObj(`No employee found with the provided ID`, 404));
    }

    // If the ID provided is another admin's
    if (ID !== req.user.ID && employee.employeeType === "ra") {
      return next(
        getErrorObj(`You cannot delete another admin's account`, 403)
      );
    }

    // Now delete the employee
    const result = await Employee.deleteEmployeeByID(ID);

    // If deletion was not completed
    if (result.deletedCount !== 1) {
      return next(getErrorObj());
    }

    // Now send the confirmation
    sendRequest({
      res,
      statusCode: 200,
      message: "Employee deleted successfully",
      data: null,
    });

    // Also delete the image and tracker for this employee
    setImmediate(async () => {
      const result = await rollbackOnUploadFailure(employee.upID);
      console.log(result);
    });
  } catch (error) {
    next(error);
  }
};

// Export the manageEmployee object
module.exports = manageEmployee;
