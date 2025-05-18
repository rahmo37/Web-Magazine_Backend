// This file implements the rate limiter module and provides general limiter and login limiter
const rateLimit = require("express-rate-limit");

// Object that contains the limiters
const requestRateLimiterObj = {};

// General limiter
requestRateLimiterObj.general = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
  headers: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: { 
        message: "Too many request, please try again later." 
      },
    });
  },
});

requestRateLimiterObj.login = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 min
  max: 5,
  headers: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        message:
          "Too many unsuccessful login attempts, please try again later.",
      },
    });
  },
});

module.exports = { requestRateLimiterObj };
