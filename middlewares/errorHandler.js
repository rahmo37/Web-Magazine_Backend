const rollbackOnUploadFailure = require("../helpers/rollbackOnUploadFailure");
const findAndReturnProperty = require("../helpers/findAndReturnProperty");

module.exports = async (err, req, res, next) => {
  if (err.name === "MulterError") {
    let message = "File upload error.";
    if (err.code === "LIMIT_FILE_SIZE") {
      message = "File too large. Maximum allowed size per image is 5MB.";
    } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
      message = "Too many files. Max is 5 per batch.";
    }
    err.message = message;
  }

  // Async iffy function that rollback image uploads
  (async () => {
    try {
      let meta = {};
      let upID = null;
      if (req.body.meta) {
        meta =
          typeof req.body.meta === "string"
            ? JSON.parse(req.body.meta)
            : req.body.meta;
      }
      // Retrieve the upID if present
      upID =
        meta.upID ??
        req.body.upID ??
        findAndReturnProperty(req.body, "upID") ??
        null;
      if (upID) {
        const result = await rollbackOnUploadFailure(upID, null, null, req);
        console.log("Rollback result:", result);
      }
    } catch (e) {
      console.warn("Rollback error: ", e.message);
    }
  })();

  // — standard handler for all other errors —
  console.error(err.message);
  return res.status(err.status || 500).json({
    error: {
      message:
        err.message ||
        "Internal server error! Please contact your administrator.",
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    },
  });
};
