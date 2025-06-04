/**
 * Employee model
 */

// Import packages
const mongoose = require("mongoose");
const { dateAndTime } = require("../helpers/dateAndTime");
const { getErrorObj } = require("../helpers/getErrorObj");

// Creating schema instance
const Schema = mongoose.Schema;

// Necessary Variables
const EMP_TYPES = process.env.EMP_TYPES.split(",");

// Employee Schema
const EmployeeSchema = new Schema(
  {
    upID: { type: String, required: true, unique: true },
    employeeID: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false },
    dateJoined: { type: Date, required: true },
    employeeType: {
      type: String,
      enum: [...EMP_TYPES],
      default: "na",
      required: true,
    },
    department: { type: [String], required: true },
    accountCreated: { type: Date, required: true },
    isActiveAccount: { type: Boolean, default: true, required: true },
    lastLogin: { type: Date, default: null },
    deniedDepartment: { type: [String], required: true, default: [] },
    temporaryApproval: { type: Boolean, default: false, required: true },
    employeeBio: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      gender: { type: String, required: true },
      dateOfBirth: { type: Date, required: true },
    },
    employeePreferences: {
      profilePicture: {
        type: String,
        default: () => process.env.DEFAULT_USER_FILENAME,
      },
      themeColor: {
        type: String,
        default: () => process.env.DEFAULT_THEME_COLOR,
      },
    },
  },
  { timestamps: true, collection: "employee" }
);

// Employee validation field
EmployeeSchema.statics.getKeys = function () {
  // Excluded fields
  const exclude = [
    "employeeID",
    "_id",
    "__v",
    "createdAt",
    "updatedAt",
    "temporaryApproval",
    "lastLogin",
    "profilePicture",
    "themeColor",
    "accountCreated",
    "isActiveAccount",
  ];

  // Get all schema paths and map each key to its final segment (i.e. employeeBio.firstName -> firstName)
  // Splits keys by ".", then pops the last segment:
  // - Nested keys: "employeeBio.value" → ["employeeBio", "value"] → "value"
  // - Non-nested keys: "name" → ["name"] → "name"
  const allowedKeys = Object.keys(this.schema.paths)
    .map((key) => key.split(".").pop())
    .filter((key) => !exclude.includes(key));

  // Remove duplicate keys (in case of naming conflicts between nested and top-level keys)
  const keys = [...new Set(allowedKeys)];
  return keys;
};

// Get all employees
EmployeeSchema.statics.getAllEmployees = async function () {
  return await this.find({});
};

// Get an employee by email
EmployeeSchema.statics.getEmployeeByEmail = async function (email) {
  return await this.findOne({ email: email.toLowerCase() });
};

// Get an employee by phone
EmployeeSchema.statics.getEmployeeByPhone = async function (phone) {
  return await this.findOne({ phone });
};

/**
 * The first method returns the employee document without the password,
 * while the second returns the employee document with the password included.
 */

// Get an employee by ID
EmployeeSchema.statics.getEmployeeByID = async function (ID) {
  return await this.findOne({ employeeID: ID });
};

// Get an employee by email including the password
EmployeeSchema.statics.getEmployeeByEmailWithPassword = async function (email) {
  return await this.findOne({ email: email.toLowerCase() }).select("+password");
};

// Save last login of an employee
EmployeeSchema.methods.updateLastLogin = async function () {
  this.lastLogin = dateAndTime.getUtcRaw();
  return await this.save();
};

// Update an employee
EmployeeSchema.methods.updateAnEmployee = async function (updateInfo) {
  try {
    // Check if phone number exists for another employee
    if (updateInfo.phone) {
      const existingEmployee = await this.constructor.findOne({
        phone: updateInfo.phone,
      });

      if (
        existingEmployee &&
        existingEmployee._id.toString() !== this._id.toString()
      ) {
        throw getErrorObj(
          `Phone number ${updateInfo.phone} is already in use.`,
          409
        );
      }
    }

    // Check if email exists for another employee
    if (updateInfo.email) {
      const existingEmployee = await this.constructor.findOne({
        email: updateInfo.email,
      });

      if (
        existingEmployee &&
        existingEmployee._id.toString() !== this._id.toString()
      ) {
        throw getErrorObj(`Email ${updateInfo.email} is already in use.`, 409);
      }
    }

    // Apply updates
    Object.keys(updateInfo).forEach((key) => {
      // Check if the key is supposed to be in the nested employeeBio object.
      if (["firstName", "lastName", "gender", "dateOfBirth"].includes(key)) {
        this.set(`employeeBio.${key}`, updateInfo[key]);
      } else {
        this.set(key, updateInfo[key]);
      }
    });

    // Finally save the employee
    return await this.save();
  } catch (error) {
    throw error;
  }
};

// Create an employee
EmployeeSchema.statics.createEmployee = async function (employeeData) {
  try {
    // Create a new employee instance
    const newEmployee = new this(employeeData);
    // Save and return the employee document
    return await newEmployee.save();
  } catch (error) {
    throw error;
  }
};

// Delete an employee
EmployeeSchema.statics.deleteEmployeeByID = async function (ID) {
  // Find the employee by their unique employeeID
  const employee = await this.findOne({ employeeID: ID });
  if (!employee) {
    throw getErrorObj(`No employee found with the provided ID: ${ID}`, 404);
  }
  // Delete the employee document
  return await employee.deleteOne();
};

// Create and export Employee model
const Employee = mongoose.model("Employee", EmployeeSchema, "employee");

module.exports = Employee;
