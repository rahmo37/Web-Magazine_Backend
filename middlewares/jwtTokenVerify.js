// This file verifies JSON Web Token (JWT)

// Importing Modules
const jwt = require("jsonwebtoken");
const jwtConfig = require("../config/jwtConfig");

// Middleware function that checks for JWT from cookies first, then headers
const authenticateToken = (req, res, next) => {
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

    // Attach user info to req object for next middleware
    req.user = user;

    // Continue to next middleware
    next();
  });
};

// Export the module
module.exports = authenticateToken;
