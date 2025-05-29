const { Worker } = require("worker_threads");
const path = require("path");
const findModule = require("./findModulePath");

function assignJob(modulePath, fnName = null, args = []) {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(args)) {
      args = args === null ? [] : Array.isArray(args) ? args : [args];
    }

    // Ensure worker path is absolute
    const workerPath = path.resolve(findModule("anyJobWorker.js"));

    // Creates a new worker thread using the given worker file, running file in parallel with the main thread
    const worker = new Worker(workerPath);

    // After the job is done we terminate the worker, and resolve or reject the promise
    worker.once("message", (msg) => {
      worker.terminate();
      msg.ok
        ? resolve(msg.result)
        : // Handles errors from within the worker job logic, sent manually via postMessage
          reject(new Error(msg.error));
    });

    // Handles critical worker thread errors (for example, failed to start, crashed, or unhandled exceptions)
    worker.once("error", reject);

    // Send the job
    worker.postMessage({ modulePath, fnName, args });
  });
}

module.exports = assignJob;
