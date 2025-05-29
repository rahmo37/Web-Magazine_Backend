// anyJobWorker.js
const { parentPort } = require("worker_threads");
const dbConfig = require("../config/db");

// Make a mongoose connection. We create new connection because main thread does not share it's connection
const mongoose = require("mongoose");
mongoose.connect(dbConfig.url);

parentPort.on("message", async (job) => {
  try {
    // Retrieve the modulePath, function name and the provided arguments in any
    const { modulePath, fnName, args = [] } = job;

    // Retrieve the module
    const mod = require(modulePath);

    // Holds the value returned by the executed job function
    let result;

    // If the module it self is a function
    if (!fnName && typeof mod === "function") {
      // If no fnName and module is a function, call it directly
      result = await mod(...args);
    }
    // If an explicit function name is provided
    else if (fnName && typeof mod[fnName] === "function") {
      result = await mod[fnName](...args);
    }
    // Throws an error if the requested function is not found in the module or if no valid function is provided
    else {
      throw new Error(
        `Function ${fnName || "default export"} not found in ${modulePath}`
      );
    }

    // After the job is done send the result
    parentPort.postMessage({ ok: true, result });
  } catch (err) {
    // If any error happens during running the job
    parentPort.postMessage({ ok: false, error: err.message });
  }
});
