// This file checks for creators without any associated links and deletes them.
const Link = require("../models/Link");
const structureChecker = require("./structureChecker");
const rollbackOnUploadFailure = require("./rollbackOnUploadFailure");
const formatLogText = require("./formatLogText");
const hemantoFdcID = process.env.HEMANTO_FDCID;
const hemantoSdcID = process.env.HEMANTO_SDCID;

// Module Scaffolding
const orphanedCreator = {};

/**
 * Trims (deletes) orphaned creators—those with no links in the Link collection.
 * - entity: a Mongoose model instance for FDC or SDC
 */
orphanedCreator.trimCreator = async function (entity) {
  try {
    const hemantoID =
      entity.modelName === "FirstDegreeCreator" ? hemantoFdcID : hemantoSdcID;
    const entityIDKeyName =
      entity.modelName === "FirstDegreeCreator" ? "fdcID" : "sdcID";
    const currentEntityIDs = [...new Set(await entity.getIDs(hemantoID))];
    const linkEntityIDs = [
      ...new Set(await Link.getEntityIDs(entityIDKeyName, hemantoID)),
    ];

    if (!structureChecker(linkEntityIDs, currentEntityIDs)) {
      const entityIDSet = new Set(linkEntityIDs);
      const extraIDsArr = currentEntityIDs.filter((ID) => !entityIDSet.has(ID));

      if (extraIDsArr.length > 0) {
        const deleteResult = await entity.deleteByIDs(extraIDsArr);

        // Delete images for each entity and log result
        for (let eachID of deleteResult.upIDs) {
          const imageDeletionResult = await rollbackOnUploadFailure(eachID);
          console.log(formatLogText(imageDeletionResult));
        }

        //  Print the result
        const resultMsg = `Orphaned ${
          entity.modelName
        }(s) deleted: ${JSON.stringify({
          deletedCount: deleteResult.deletedCount,
          extraIDsArr,
        })}`;
        console.log(formatLogText(resultMsg));
      } else {
        const warnMsg = `No orphaned ${entity.modelName}(s) to delete. However, the structure did not match with the Link collection. Please reconcile the Link entity promptly!`;
        console.log(formatLogText(warnMsg));
      }
    } else {
      const noOrphanMsg = `No orphaned ${entity.modelName}(s) found.`;
      console.log(formatLogText(noOrphanMsg));
    }
  } catch (error) {
    const errorMsg = `Error trimming orphaned ${entity.modelName}(s): ${error}`;
    console.error(formatLogText(errorMsg));
  }
};

module.exports = orphanedCreator;
