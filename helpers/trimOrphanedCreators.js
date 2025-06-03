// This file checks for creators without any associated links and deletes them.
const Link = require("../models/Link");
const structureChecker = require("./structureChecker");
const rollbackOnUploadFailure = require("./rollbackOnUploadFailure");
const hemantoFdcID = process.env.HEMANTO_FDCID;
const hemantoSdcID = process.env.HEMANTO_SDCID;

// Module Scaffolding
const orphanedCreator = {};

// This function trims the orphaned creators
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


        // Delete images for each entity
        for (let eachID of deleteResult.upIDs) {
          const imageDeletionResult = await rollbackOnUploadFailure(eachID);
          console.log(imageDeletionResult);
        }

        //  Print the result
        console.log(`Orphaned ${entity.modelName}(s) deleted`, {
          deletedCount: deleteResult.deletedCount,
          extraIDsArr,
        });
      } else {
        console.log(
          `No orphaned ${entity.modelName}(s) to delete. However the structure did not match with the Link collection please reconcile the Link entity promptly!`
        );
      }
    } else {
      console.log(`No orphaned ${entity.modelName}(s) found`);
    }
  } catch (error) {
    console.error(`Error trimming orphaned ${entity.modelName}(s):`, error);
  }
};

module.exports = orphanedCreator;
