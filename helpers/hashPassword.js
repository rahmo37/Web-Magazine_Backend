// This module hashes the entity password if it's currently in plain text

// Importing modules
const bcrypt = require("bcrypt");
const { dateAndTime } = require("../helpers/dateAndTime");
const formatLogText = require("./formatLogText");

// Module scaffolding
let hashPassword = {};

/**
 * Returns a bcrypt-hashed version of the input password.
 * @param {string} password - The plaintext password to hash.
 * @returns {Promise<string>} - The bcrypt hash.
 */
hashPassword.getHashedPassword = async (password) => {
  return await bcrypt.hash(password, 10);
};

/**
 * Goes through each entity in the provided array of models.
 * For every document in each model, hashes the password if it's not already hashed
 * (assumed if its length is less than 35 characters).
 * Logs progress and completion/failure.
 * @param {Array} entityModels - Array of Mongoose model classes.
 */
hashPassword.hashPasswordInDatabase = async function (entityModels) {
  try {
    if (!Array.isArray(entityModels)) {
      throw new Error("Provided parameter must be an array");
    }
    // Fetching all entities
    for (let model of entityModels) {
      const document = await model.find({}).select("+password");
      for (let each of document) {
        const currentPass = each.password;

        if (currentPass.length < 35) {
          // Usually bcrypt hashed password is more than 35 characters
          const hashed = await hashPassword.getHashedPassword(currentPass);
          each.password = hashed;
          await each.save();
          console.log(
            formatLogText(`Password hashed for --> ${each.email}`)
          );
        }
      }
    }
    console.log(formatLogText("Hashing completed..."));
  } catch (error) {
    console.log(formatLogText(`Hashing failed... ${error}`));
  }
};

module.exports = hashPassword;
