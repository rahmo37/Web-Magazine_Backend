// This module assigns a job to a worker thread
const { Worker } = require("worker_threads");
const path = require("path");
const findModule = require("./findModulePath");
const { generateID } = require("./generateID");
const formatLogText = require("../helpers/formatLogText");

/**
 * Main rollback function
 * @param {String} modulePath - Expects full module path where the functions resides
 * @param {fnName} fnName - The function to be executed
 * @param {args} args - If there are any arguments of that function
 */
function assignJob(modulePath, fnName = null, args = []) {
  return new Promise((resolve, reject) => {
    //  Confirm arg is an array
    args = [].concat(args ?? []);

    //  Retrieve the job handler path
    const workerPath = path.resolve(findModule("anyJobWorker.js"));

    // Assign the job handler with new worker
    const worker = new Worker(workerPath);

    //  Generate a worker ID
    worker.ID = generateID("worker_", 2);

    // If message event is emitted we assume job is completed
    worker.once("message", (msg) => {
      // Terminate the worker
      worker.terminate().then(() => {
        console.log(`${worker.ID} Terminated`);

        // After worker is terminated resolve or reject the result
        msg.ok
          ? resolve(msg.result)
          : // If any job related error happens
            reject(new Error(msg.error));
      });
    });

    // If any Worker related error happens
    worker.once("error", reject);

    // Assign the task
    worker.postMessage({ modulePath, fnName, args });

    console.log(
      formatLogText(
        `${fnName || "Task"} from module ${modulePath} assigned to workerID: ${
          worker.ID
        }`
      )
    );
  });
}

module.exports = assignJob;
