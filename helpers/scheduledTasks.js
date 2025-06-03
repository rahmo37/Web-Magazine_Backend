// scheduler.js
const cron = require("node-cron");
const { dateAndTime } = require("../helpers/dateAndTime");
const findModule = require("./findModulePath");
const assignJob = require("./assignJob");

// Cron expression: every day at 12:00 PM New York time
const timeExpression = "0 12 * * *";

// Validate the expression
if (!cron.validate(timeExpression)) {
  console.error("❌ Invalid cron expression:", timeExpression);
  process.exit(1);
}

const scheduler = {};

// Define the scheduled task (but don’t start it yet)
scheduler.dbMaintenance = cron.schedule(
  timeExpression,
  async () => {
    console.log(
      "🔄 Running scheduled maintenance:",
      dateAndTime.getLocalFormatted()
    );

    // Assigning Worker thread for maintenance
    assignJob(findModule("maintenanceFunctions.js"))
      .then(() => {
        console.log(
          "Maintenance completed at",
          dateAndTime.getLocalFormatted()
        );
      })
      .catch((err) => {
        console.log(err);
      });
  },
  {
    scheduled: false,
    timezone: "America/New_York",
  }
);

// This function does manual maintenance
scheduler.manualMaintenance = async function () {
  assignJob(findModule("maintenanceFunctions.js"))
    .then(() => {
      console.log(
        "🚀 Initial maintenance completed at",
        dateAndTime.getLocalFormatted()
      );
    })
    .catch((err) => {
      console.log(err);
    });
};

// Immediately run one maintenance upon server start up
scheduler.manualMaintenance();

// Gracefully stop cron on exit
process.on("SIGINT", () => {
  console.log("🛑 Stopping scheduled tasks");
  scheduler.dbMaintenance.stop();
  process.exit(0);
});

module.exports = scheduler;
