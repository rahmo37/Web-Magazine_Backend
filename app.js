/**
 * Author: Obaedur, Rakib
 * Date: 07-jan-25
 * Description: This is the starting file of the Web Magazine Project
 */

// ---------------------------------Imports---------------------------------
// Project configuration imports
const envFile = `.env.${process.env.NODE_ENV || "development"}`;
require("dotenv").config({ path: envFile });
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
// const parseImageMeta = require("./middlewares/parseImageMeta");
const requestInfo = require("./middlewares/logRequestInformation");
const dbConfig = require("./config/db");
const { dbMaintenance } = require("./helpers/scheduledTasks");
const authenticateToken = require("./middlewares/jwtTokenVerify");
const roleVerify = require("./middlewares/roleVerification");
const cookieParser = require("cookie-parser");

// Security imports
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const { requestRateLimiterObj } = require("./middlewares/requestRateLimiter");

// Error related imports
const errorHandler = require("./middlewares/errorHandler");
const routeNotFoundHandler = require("./middlewares/routeNotFoundHandler");

// Importing models
const Employee = require("./models/Employee");

// Importing Routers
const {
  employeeLoginRouter,
} = require("./routes/authentication/employeeLoginRouter");
const { manageEmployeeRouter } = require("./routes/admin/manageEmployeeRouter");
const { manageFdcRouter } = require("./routes/employee/manageFdcRouter");
const { manageSdcRouter } = require("./routes/employee/manageSdcRouter");
const {
  manageGoddoRouter,
} = require("./routes/employee/content/manageGoddoRouter");
const {
  manageLinkRouter,
} = require("./routes/employee/content/manageLinkRouter");

// Other Imports
const { sendRequest } = require("./helpers/sendRequest");

// ---------------------------------Project variables---------------------------------
const PORT = process.env.PORT || 8000;

//!Application logic starts here -->

// -------------------------Project Configurations and Security-----------------------
const app = express();

// Limit request rate from an IP address if in production
app.use(
  process.env.NODE_ENV === "development"
    ? (req, res, next) => next()
    : requestRateLimiterObj?.general || ((req, res, next) => next())
);

//Set security headers
app.use(helmet());

// Enabling cors-origin requests. During development only allowing front-end development team. Below origins are allowed
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:5501",
  "http://localhost:5500",
  "http://localhost:5501",
  "http://localhost:8000",
  "http://localhost:5172",
  "http://localhost:5173",
];
app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like Postman, or get request from browser)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Log Request Information
app.use(requestInfo);

// Data parsing middleware
app.use(bodyParser.json({ limit: "50mb" }));

// Mongodb query sanitize
app.use(mongoSanitize());

// Cross-Site Scripting sanitization
app.use(xss());

// Parse any cookie
app.use(cookieParser());

// ---------------------------------End-points---------------------------------

// Employee Routes

// Check JWT token validity
app.use("/api/auth/check", authenticateToken, (req, res) => {
  return sendRequest({
    res,
    statusCode: 200,
    message: "Token is valid",
    data: req.user,
  });
});

// Login route
// Rate-Limiter for login in production
app.use(
  "/api/employee/login",
  process.env.NODE_ENV === "development"
    ? (req, res, next) => next()
    : requestRateLimiterObj?.login || ((req, res, next) => next()),
  employeeLoginRouter
);

//* Only employees are allowed beyond this point and Requests must have JWT token
app.use(authenticateToken, roleVerify.isEmployee);


// Employee Management Route
app.use("/api/manage/employee", manageEmployeeRouter);

// FDC Management Route
app.use("/api/manage/fdc", manageFdcRouter);

// SDC Management Route
app.use("/api/manage/sdc", manageSdcRouter);

// Content Management Route
// Content Links
app.use("/api/manage/link", manageLinkRouter);

// Goddo
app.use("/api/manage/goddo", manageGoddoRouter);

// ---------------------------------Error Handlers---------------------------------

// Not found error handler, if no routes matches this middleware is called
app.use(routeNotFoundHandler);

// Error handling middleware
app.use(errorHandler);

// ---------------------------------Database Connection---------------------------------
mongoose
  .connect(dbConfig.url)
  .then(() => {
    console.log("Database Connected...");

    // Server starts listening
    app.listen(PORT, () => {
      console.log("App listening on port", PORT);
    });

    // Start database maintenance
    console.log("⏰ Starting daily maintenance schedule");
    dbMaintenance.start();
  })
  .catch((err) => {
    console.error("Database Connection Error:", err);
  });
