// scheduler.js
const cron = require("node-cron");
const { dateAndTime } = require("../helpers/dateAndTime");
const findModule = require("./findModulePath");
const assignJob = require("./assignJob");
const formatLogText = require("./formatLogText");

// Cron expression: every day at 12:00 PM New York time
const timeExpression = "0 12 * * *";

// Validate the expression
if (!cron.validate(timeExpression)) {
  // Use plain log here since formatLogText is async and can't be awaited at top-level sync code
  formatLogText(`❌ Invalid cron expression: ${timeExpression}`).then((msg) =>
    console.error(msg)
  );
  process.exit(1);
}

const scheduler = {};

/**
 * Scheduled task for daily DB maintenance.
 * Runs every day at 12:00 PM New York time (disabled at start).
 */
scheduler.dbMaintenance = cron.schedule(
  timeExpression,
  async () => {
    console.log(
      formatLogText(
        `🔄 Running scheduled maintenance`,
        dateAndTime.getLocalFormatted()
      )
    );

    // Assigning Worker thread for maintenance
    assignJob(findModule("maintenanceFunctions.js"))
      .then(async () => {
        console.log(
          formatLogText(
            `Maintenance completed at`,
            dateAndTime.getLocalFormatted()
          )
        );
      })
      .catch(async (err) => {
        console.log(formatLogText(err));
      });
  },
  {
    scheduled: false,
    timezone: "America/New_York",
  }
);

/**
 * Immediately run maintenance manually upon server startup.
 */
scheduler.manualMaintenance = function () {
  assignJob(findModule("maintenanceFunctions.js"))
    .then(() => {
      console.log(
        formatLogText(
          `🚀 Maintenance completed at:`,
          dateAndTime.getLocalFormatted()
        )
      );
    })
    .catch((err) => {
      console.log(formatLogText(err));
    });
};

// Run one maintenance immediately when server starts
scheduler.manualMaintenance();

/**
 * Gracefully stop cron on exit (Ctrl+C).
 */
process.on("SIGINT", async () => {
  console.log(formatLogText("🛑 Stopping scheduled tasks"));
  scheduler.dbMaintenance.stop();
  process.exit(0);
});

module.exports = scheduler;
