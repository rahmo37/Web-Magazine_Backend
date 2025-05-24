// scheduler.js
const cron = require("node-cron");
const Employee = require("../models/Employee");
const FirstDegreeCreator = require("../models/FirstDegreeCreator");
const SecondDegreeCreator = require("../models/SecondDegreeCreator");
const { hashPasswordInDatabase } = require("./hashPassword");
const { trimCreator } = require("./trimOrphanedCreators");
const { trimContents } = require("./trimOrphanedContents");
const { dateAndTime } = require("../helpers/dateAndTime");

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
    console.log("🔄 Running scheduled maintenance:", new Date());
    await allMaintenanceFunctions();
  },
  {
    scheduled: false,
    timezone: "America/New_York",
  }
);

// Orchestrator with per‑step try/catch
async function allMaintenanceFunctions() {
  // 1) Hash any unhashed passwords
  try {
    await hashPasswordInDatabase([Employee]);
  } catch (err) {
    console.error("⚠️ Error during password hashing:", err);
  }

  // 2) Trim orphaned first‑degree creators
  try {
    await trimCreator(FirstDegreeCreator);
  } catch (err) {
    console.error("⚠️ Error trimming FirstDegreeCreator:", err);
  }

  // 3) Trim orphaned second‑degree creators
  try {
    await trimCreator(SecondDegreeCreator);
  } catch (err) {
    console.error("⚠️ Error trimming SecondDegreeCreator:", err);
  }

  // 4) Trim orphaned contents
  try {
    await trimContents();
  } catch (err) {
    console.error("⚠️ Error in trimContents:", err);
  }
}

scheduler.manualMaintenance = async function () {
  await allMaintenanceFunctions();
  console.log(
    "🚀 Initial maintenance completed at",
    dateAndTime.getLocalFormatted()
  );
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
