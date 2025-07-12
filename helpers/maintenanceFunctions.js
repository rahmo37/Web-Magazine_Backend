const Employee = require("../models/Employee");
const FirstDegreeCreator = require("../models/FirstDegreeCreator");
const SecondDegreeCreator = require("../models/SecondDegreeCreator");
const { hashPasswordInDatabase } = require("./hashPassword");
const { trimCreator } = require("./trimOrphanedCreators");
const { trimContents } = require("./trimOrphanedContents");

// Orchestrator with per‑step try/catch
module.exports = async function allMaintenanceFunctions() {
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
};
