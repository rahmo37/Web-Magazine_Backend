// This module handles any job provided to it
const { parentPort } = require("worker_threads");
const mongoose = require("mongoose");
const dbConfig = require("../config/db");
const path = require("path");

// After job is provided
parentPort.on("message", async (job) => {
  try {
    // Connect to the DB if DB related job is sent
    await mongoose.connect(dbConfig.url);

    //  Retrieve the modulePath, function name, and arguments passed
    const { modulePath, fnName, args = [] } = job;

    //  module must be an absolute path
    if (!path.isAbsolute(modulePath)) {
      throw new Error(`Provided path is not absolute must be a`);
    }

    // Get the module
    const mod = require(modulePath);

    // Placeholder
    let result;

    //  If the module it-self is a function
    if (!fnName && typeof mod === "function") {
      result = await mod(...args);
    }
    // Otherwise we cal the regular function that is passed-in
    else if (fnName && typeof mod[fnName] === "function") {
      result = await mod[fnName](...args);
    }
    // If any error happens, we throw the error
    else {
      throw new Error(
        `Function ${fnName || "default export"} not found in ${modulePath}`
      );
    }

    // Send resolved result
    parentPort.postMessage({ ok: true, result });
  } catch (err) {
    // Send rejected result
    parentPort.postMessage({ ok: false, error: err.message });
  } finally {
    // Finally disconnect from database
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }
});
