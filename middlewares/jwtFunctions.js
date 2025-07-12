// This file verifies JSON Web Token (JWT)

// Importing Modules
const jwt = require("jsonwebtoken");
const jwtConfig = require("../config/jwtConfig");
const { dateAndTime } = require("../helpers/dateAndTime");

// Module Scaffolding
const jwtFunctions = {};

// Middleware function that checks for JWT from cookies first, then headers
jwtFunctions.authenticateToken = (req, res, next) => {
  let token;
  // Priority 1: Check for token in cookies
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // Priority 2: Check for token in Authorization header
  else if (req.headers["authorization"]) {
    const authHeader = req.headers["authorization"];
    token = authHeader.split(" ")[1];
  }

  // If token is not found, return error
  if (!token) {
    const err = new Error(
      "Missing token!! Please obtain an authorization token before proceeding"
    );
    err.status = 401;
    return next(err);
  }

  // Verify the token
  jwt.verify(token, jwtConfig.secret, (err, user) => {
    if (err) {
      err.status = 401;
      err.message = "Invalid token and signature";
      return next(err);
    }

    // Reformat the time when the token is provided
    user.iat = dateAndTime.convertToLocalFormatted(
      new Date(user.iat * 1000)
    ).time;

    // Reformat the time when the token is expired
    user.exp = dateAndTime.convertToLocalFormatted(
      new Date(user.exp * 1000)
    ).time;

    // Attach user info to req object for next middleware
    req.user = user;

    // Continue to next middleware
    next();
  });
};

jwtFunctions.signToken = (payload) => {
  // Signing the token with payload, secret, and expiry time
  const token = jwt.sign(payload, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
  });

  return token;
};

jwtFunctions.setTokenAsHttpOnly = function (token, res) {
  // Set JWT as an HTTP-only cookie:
  res.cookie("token", token, {
    httpOnly: true, // Cookie inaccessible from JavaScript on client-side, preventing XSS attacks.
    secure: true, // Send over HTTPs.
    sameSite: "none",
    expires: new Date(Date.now() + 3600000 * 4), // 4 hr from now
  });
};

// Export the module
module.exports = jwtFunctions;
