const { getErrorObj } = require("../helpers/getErrorObj");

module.exports = function parseImageMeta(req, res, next) {
  // Parse meta only if it’s still a string
  if (req.body.meta && typeof req.body.meta === "string") {
    try {
      req.body.meta = JSON.parse(req.body.meta);
    } catch (err) {
      return next(getErrorObj("Invalid JSON in meta field.", 400));
    }
  }

  // If there’s no meta at all, nothing to validate—move on
  if (!req.body.meta) return next();

  const { upID, batchNumber } = req.body.meta;

  // Validate upID ─ must be a non-empty string
  if (typeof upID !== "string" || upID.trim() === "") {
    return next(
      getErrorObj("meta.upID is required and must be a non-empty string.", 400)
    );
  }

  // Validate batchNumber ─ must be a non-negative integer
  if (!Number.isInteger(batchNumber) || batchNumber < 1) {
    return next(
      getErrorObj(
        "meta.batchNumber is required and must be a non-negative integer.",
        400
      )
    );
  }

  // All good—hand off to the next step
  next();
};
