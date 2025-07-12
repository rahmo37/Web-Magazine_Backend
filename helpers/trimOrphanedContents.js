// This script removes orphaned content entries by reconciling all content entities with the Link entity
const Goddo = require("../models/Departments/Goddo");
const Shongit = require("../models/Departments/Shongit");
const Link = require("../models/Link");
const structureChecker = require("./structureChecker");
const rollbackOnUploadFailure = require("./rollbackOnUploadFailure");
const formatLogText = require("./formatLogText");

// Module Scaffolding
const orphanedContent = {};

// This function trims the orphaned contents
orphanedContent.trimContents = async function () {
  await trimmer(Goddo, "god_");
  // await trimmer(Shongit, "gan_");
};

// Helper function that performs the trimming
async function trimmer(entity, IDPrefix) {
  try {
    // Get the ids of the entity
    const currentEntityIDs = await entity.getIDs();

    const linkEntityIDs = (await Link.getEntityIDs("contentID")).filter((ID) =>
      ID.startsWith(IDPrefix)
    );

    if (!structureChecker(linkEntityIDs, currentEntityIDs)) {
      const entityIDSet = new Set(linkEntityIDs);
      const extraIDsArr = currentEntityIDs.filter((ID) => !entityIDSet.has(ID));

      if (extraIDsArr.length > 0) {
        const deleteResult = await entity.deleteByIDs(extraIDsArr);

        // Delete images for each entity
        for (let eachID of deleteResult.upIDs) {
          const imageDeletionResult = await rollbackOnUploadFailure(eachID);
          console.log(formatLogText(imageDeletionResult));
        }

        // Success Confirmation
        console.log(
          formatLogText(`Orphaned ${entity.modelName}(s) deleted`, {
            deletedCount: deleteResult.deletedCount,
            extraIDsArr,
          })
        );
      } else {
        console.log(
          formatLogText(`No orphaned ${entity.modelName}(s) to delete`)
        );
      }
    } else {
      console.log(formatLogText(`No orphaned ${entity.modelName}(s) found`));
    }
  } catch (error) {
    console.log(error);
  }
}

module.exports = orphanedContent;
