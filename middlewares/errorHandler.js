const rollbackOnUploadFailure = require("../helpers/rollbackOnUploadFailure");

module.exports = async (err, req, res, next) => {
  if (err.name === "MulterError") {
    let message = "File upload error.";
    if (err.code === "LIMIT_FILE_SIZE") {
      message = "File too large. Maximum allowed size per image is 5MB.";
    } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
      message = "Too many files. Max is 5 per batch.";
    }

    // Try to parse upID and roll back only if we actually have one
    try {
      const meta = JSON.parse(req.body.meta || "{}");
      const upID = meta.upID;
      if (upID) {
        const result = await rollbackOnUploadFailure(upID); // fileNames defaults to null
        console.log("Rollback result:", result);
      } else {
        console.log("No upID found. Could not perform rollback");
      }
    } catch (e) {
      console.warn("Metadata parse skipped during Multer error:", e.message);
    }

    console.error(message);
    return res.status(400).json({ error: message });
  }

  // — standard handler for all other errors —
  console.error(err);
  return res.status(err.status || 500).json({
    error: {
      message:
        err.message ||
        "Internal server error! Please contact your administrator.",
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    },
  });
};
