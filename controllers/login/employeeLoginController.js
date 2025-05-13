// This file contains the login/authentication logic for employee

// Importing Modules
const Employee = require("../../models/Employee");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const jwtConfig = require("../../config/jwtConfig");

const { getErrorObj } = require("../../helpers/getErrorObj");
const isDevelopment = process.env.NODE_ENV === "development";
const { sendRequest } = require("../../helpers/sendRequest");

async function login(req, res, next) {
  try {
    // Retrieve the email and password property
    const { email, password } = req.body;

    // If no email and password is provided with the req
    if (!email || !password) {
      return next(
        getErrorObj(
          "You must provide email and password in order to sign-in",
          404
        )
      );
    }

    // Fetch the employee
    const employee = await Employee.getEmployeeByEmailWithPassword(email);

    // If no employee is found
    if (!employee) {
      return next(
        getErrorObj(
          isDevelopment
            ? "No employee exists with the provided email!"
            : "Invalid email or password provided",
          401
        )
      );
    }

    // Check the password
    const isMatch = await bcrypt.compare(password, employee.password);

    // If no match
    if (!isMatch) {
      return next(
        getErrorObj(
          isDevelopment
            ? "Invalid password!"
            : "Invalid email or password provided!",
          401
        )
      );
    }

    // If the account is inactive
    if (!employee.isActiveAccount) {
      return next(
        getErrorObj(
          "This account is currently deactivated!. Please contact your administrator",
          401
        )
      );
    }

    // Update the last login field
    const isLoginSaved = await employee.updateLastLogin();

    // Check if the login was saved
    if (!isLoginSaved) {
      return next(
        getErrorObj(
          isDevelopment
            ? "Error while saving the last login field"
            : "Internal Server Error! Please contact your administrator.",
          500
        )
      );
    }

    // Creating a payload that will be sent with the token
    const userPayload = {
      ID: employee.employeeID,
      email: employee.email,
      role: "employee",
      employeeType: employee.employeeType,
    };

    // Signing the token with payload, secret, and expiry time
    const token = jwt.sign(userPayload, jwtConfig.secret, {
      expiresIn: jwtConfig.expiresIn,
    });

    // Convert the employee mongo instance to js object
    const employeeData = employee.toObject();
    delete employeeData.password;

    // Send JWT as an HTTP-only cookie:
    res.cookie("token", token, {
      httpOnly: true, // Cookie inaccessible from JavaScript on client-side, preventing XSS attacks.
      secure: process.env.NODE_ENV === "production", // Only sent over HTTPS in production.
      sameSite: "strict", // Prevents cookie from being sent with cross-site requests.
      expires: new Date(Date.now() + 3600000 * 4), // 4 hr from now
    });

    // Send the response
    sendRequest({
      res,
      statusCode: 200,
      message: "User is validated!",
      data: employeeData,
      token,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { login };
