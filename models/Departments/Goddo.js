/**
 * Department Model
 * * Goddo
 */

// importing packages
const mongoose = require("mongoose");
const { getErrorObj } = require("../../helpers/getErrorObj");

// creating schema instance
const Schema = mongoose.Schema;

const SectionSchema = new Schema({
  sectionID: { type: String, required: true, unique: true }, // unique: true, Also creates individual index
  sectionAddedDate: { type: Date, required: true },
  sectionArticle: { type: String, required: true },
  sectionImages: { type: [String], default: [] },
});

const ArticleSchema = new Schema({
  articleCover: {
    type: String,
    default: () => process.env.DEFAULT_PLACEHOLDER_FILENAME,
  },
  articleName: { type: String, required: true },
  articleTrailer: { type: String, default: "" },
  aboutArticle: { type: String, default: "" },
  mainContent: [SectionSchema],
});

const MetadataSchema = new Schema({
  upID: { type: String, unique: true },
  godID: { type: String, required: true, unique: true }, // unique: true, Also creates individual index
  contentAddedDate: { type: Date, required: true },
  originalWritingDate: { type: Date, default: null },
});

const SubcategorySchema = new Schema(
  {
    subcategoryID: { type: String, required: true, unique: true }, // unique: true, Also creates individual index
    subcategoryName: { type: String, required: true },
    content: [
      {
        metadata: MetadataSchema,
        article: ArticleSchema,
      },
    ],
  },
  { timestamps: true, collection: "goddo" }
);

// Compound Index
SubcategorySchema.index({
  subcategoryID: 1,
  "content.metadata.godID": 1,
  "content.article.mainContent.sectionID": 1,
});

// Get all goddo
SubcategorySchema.statics.getAllGoddo = async function () {
  return await this.find({});
};

// Get one goddo
SubcategorySchema.statics.getGoddoWithID = async function (godID) {
  const result = await this.aggregate([
    { $unwind: "$content" },
    { $match: { "content.metadata.godID": godID } },
    {
      $project: {
        _id: 0,
        subcategoryName: 1,
        metadata: "$content.metadata",
        article: "$content.article",
        _id: "$content._id",
      },
    },
  ]);

  return result.length ? result[0] : null;
};

// Get goddo keys
SubcategorySchema.statics.getKeys = function () {
  // Excluded fields
  const exclude = [
    "subcategoryName",
    "_id",
    "__v",
    "content",
    "godID",
    "upID",
    "contentAddedDate",
    "articleCover",
    "articleTrailer",
    "aboutArticle",
    "originalWritingDate",
    "mainContent",
    "sectionAddedDate",
    "sectionID",
    "sectionImages",
    "createdAt",
    "updatedAt",
  ];
  const allowedKeys = [
    ...Object.keys(this.schema.paths),
    ...Object.keys(ArticleSchema.paths),
    ...Object.keys(MetadataSchema.paths),
    ...Object.keys(SectionSchema.paths),
  ]
    .map((key) => key.split(".").pop())
    .filter((key) => !exclude.includes(key));

  const keys = [...new Set(allowedKeys)];
  return keys;
};

// Get metadata keys
SubcategorySchema.statics.getMetadataKeys = function () {
  // Excluded fields
  const exclude = [
    "_id",
    "__v",
    "godID",
    "contentAddedDate",
    "createdAt",
    "updatedAt",
  ];
  const allowedKeys = [...Object.keys(MetadataSchema.paths)]
    .map((key) => key.split(".").pop())
    .filter((key) => !exclude.includes(key));
  const keys = [...new Set(allowedKeys)];
  return keys;
};

// Get article keys
SubcategorySchema.statics.getArticleKeys = function () {
  // Excluded fields
  const exclude = [
    "articleTrailer",
    "aboutArticle",
    "articleCover",
    "mainContent",
    "_id",
    "__v",
    "createdAt",
    "updatedAt",
  ];
  const allowedKeys = [...Object.keys(ArticleSchema.paths)]
    .map((key) => key.split(".").pop())
    .filter((key) => !exclude.includes(key));
  const keys = [...new Set(allowedKeys)];
  return keys;
};

SubcategorySchema.statics.getAGoddoSection = async function (
  subID,
  godID,
  secID
) {
  // 1. Query the right subcategory (defensive: check for null)
  const goddoCategory = await this.findOne({
    subcategoryID: subID,
    content: {
      $elemMatch: {
        "metadata.godID": godID,
        "article.mainContent.sectionID": secID,
      },
    },
  }).hint({
    subcategoryID: 1,
    "content.metadata.godID": 1,
    "content.article.mainContent.sectionID": 1,
  });

  // 2. Throw error if not found
  if (!goddoCategory) {
    throw getErrorObj("No goddo section found with the provided IDs", 400);
  }

  for (const content of goddoCategory.content) {
    if (content.metadata.godID === godID) {
      const foundSection = content.article.mainContent.find(
        (section) => section.sectionID === secID
      );
      if (foundSection) return foundSection;
    }
  }

  throw getErrorObj("No goddo section found with the provided IDs", 400);
};

// Create a goddo with subcategory ID. find the subcategory and just push the goddo
SubcategorySchema.statics.createAGoddoWithSubcategoryID = async function (
  subcategoryID,
  goddoData,
  session
) {
  // First find the subcategory
  const subcategory = await this.findOne({ subcategoryID });
  // If not found
  if (!subcategory) {
    throw getErrorObj("No subcategory found with the provided subcategoryID");
  }
  // Then add the goddoData
  subcategory.content.push(goddoData);
  // Finally save
  await subcategory.save({ session });
  return subcategory;
};

// Update a goddo's section data
SubcategorySchema.statics.updateAGoddoSection = async function (
  subID,
  godID,
  secID,
  updatedSectionData
) {
  let updatedSection = null;

  // Find the subcategory exactly matching the IDs
  const goddoCategory = await this.findOne({
    subcategoryID: subID,
    content: {
      $elemMatch: {
        "metadata.godID": godID,
        "article.mainContent.sectionID": secID,
      },
    },
  }).hint({
    subcategoryID: 1,
    "content.metadata.godID": 1,
    "content.article.mainContent.sectionID": 1,
  });

  // If the subcategory not found with the provided IDs
  if (!goddoCategory) {
    throw getErrorObj("No goddo section found with the provided IDs", 400);
  }

  // A variable that will confirms the update
  let updated = false;

  // Find the subcategory and then update the section
  for (const content of goddoCategory.content) {
    if (content.metadata.godID === godID) {
      for (let section of content.article.mainContent) {
        if (section.sectionID === secID) {
          // Merge (update) the existing section with the new fields.
          Object.assign(section, updatedSectionData);
          updated = true;
          updatedSection = section;
        }
      }
    }
  }

  // If updated failed
  if (!updated) {
    throw getErrorObj("Update was not successful", 500);
  }

  // Now save the updated goddo
  await goddoCategory.save();

  // Return the section as plain js object
  return updatedSection.toObject();
};

// Updated a goddo's metadata
SubcategorySchema.statics.updateAGoddoMetadata = async function (
  subID,
  godID,
  metadata
) {
  let updatedMetadata = null;
  let updated = false;

  // Find the subcategories exactly matching the IDs
  const goddoCategory = await this.findOne({
    subcategoryID: subID,
    content: {
      $elemMatch: {
        "metadata.godID": godID,
      },
    },
  }).hint({
    subcategoryID: 1,
    "content.metadata.godID": 1,
    "content.article.mainContent.sectionID": 1,
  });

  // If the subcategory not found with the provided ids
  if (!goddoCategory) {
    throw getErrorObj("No goddo found with the provided IDs", 400);
  }

  // Find and merge the metadata
  for (let content of goddoCategory.content) {
    if (content.metadata.godID === godID) {
      updatedMetadata = Object.assign(content.metadata, metadata);
      updated = true;
    }
  }

  // If update failed
  if (!updated) {
    throw getErrorObj("Update was not successful", 500);
  }

  // Save the goddo
  await goddoCategory.save();

  // Return the metadata
  return updatedMetadata.toObject();
};

// Updated a goddo's article
SubcategorySchema.statics.updateAGoddoArticle = async function (
  subID,
  godID,
  articleData
) {
  let updatedArticleData = null;
  let updated = false;

  // Find the subcategories exactly matching the IDs
  const goddoCategory = await this.findOne({
    subcategoryID: subID,
    content: {
      $elemMatch: {
        "metadata.godID": godID,
      },
    },
  }).hint({
    subcategoryID: 1,
    "content.metadata.godID": 1,
    "content.article.mainContent.sectionID": 1,
  });

  // If the subcategory not found with the provided ids
  if (!goddoCategory) {
    throw getErrorObj("No goddo found with the provided IDs", 400);
  }

  // Find and merge the article data
  for (let content of goddoCategory.content) {
    if (content.metadata.godID === godID) {
      updatedArticleData = Object.assign(content.article, articleData);
      updated = true;
    }
  }

  // If update failed
  if (!updated) {
    throw getErrorObj("Update was not successful", 500);
  }

  // Save the goddo
  await goddoCategory.save();

  // Return the article data, remove the main content
  const article = updatedArticleData.toObject();
  delete article.mainContent;
  return article;
};

SubcategorySchema.statics.deleteAGoddoSection = async function (
  subID,
  godID,
  secID
) {
  const goddoCategory = await this.findOne({
    subcategoryID: subID,
    content: {
      $elemMatch: {
        "metadata.godID": godID,
        "article.mainContent.sectionID": secID,
      },
    },
  }).hint({
    subcategoryID: 1,
    "content.metadata.godID": 1,
    "content.article.mainContent.sectionID": 1,
  });

  // If the subcategory not found with the provided IDs
  if (!goddoCategory) {
    throw getErrorObj("No goddo section found with the provided IDs", 400);
  }

  let deletedSection = null;
  let upID = null;

  for (const content of goddoCategory.content) {
    if (content.metadata.godID === godID) {
      if (content.article.mainContent.length === 1) {
        throw new Error(
          "This is the last section of this Goddo and cannot be deleted. You can update this section or delete the entire Goddo if necessary"
        );
      }

      const sectionIndex = content.article.mainContent.findIndex(
        (section) => section.sectionID === secID
      );

      if (sectionIndex !== -1) {
        // Save deleted section and upID
        deletedSection = content.article.mainContent[sectionIndex];
        upID = content.metadata.upID;

        // Remove the section
        content.article.mainContent.splice(sectionIndex, 1);
      }
    }
  }

  if (!deletedSection) {
    throw getErrorObj("Section not found for deletion", 400);
  }

  // Save the updated subcategory document
  await goddoCategory.save();

  // Return both the deleted section and upID
  return { deletedSection, upID };
};

// Delete many Goddos with godIDs array
SubcategorySchema.statics.deleteByIDs = async function (goddoIDs) {
  if (!Array.isArray(goddoIDs) || goddoIDs.length === 0) {
    throw new Error("You must provide a non‑empty array of goddoIDs");
  }

  // 1. Find all subcategories that contain content with these godIDs
  const docs = await this.find(
    { "content.metadata.godID": { $in: goddoIDs } },
    { content: 1 }
  );

  // 2. Collect all upIDs for the goddos being deleted
  const upIDs = [];
  for (const doc of docs) {
    for (const goddo of doc.content) {
      if (goddoIDs.includes(goddo.metadata.godID)) {
        if (goddo.metadata.upID) upIDs.push(goddo.metadata.upID);
      }
    }
  }

  // 3. Pull any content sub-document whose metadata.godID is in the provided array
  await this.updateMany(
    {},
    {
      $pull: {
        content: { "metadata.godID": { $in: goddoIDs } },
      },
    }
  );

  // 4. Return both deletedCount and upIDs
  return {
    deletedCount: upIDs.length,
    upIDs,
  };
};

// Delete a goddo with a provided subID and godID, and return the deleted goddo
SubcategorySchema.statics.deleteAGoddoByID = async function (
  subID,
  godID,
  session = null
) {
  // Find the subcategory with the goddo
  const doc = await this.findOne(
    {
      subcategoryID: subID,
      "content.metadata.godID": godID,
    },
    { content: 1 }, // only select content field
    { session }
  );

  if (!doc) {
    throw getErrorObj(`No goddo found with the IDs provided`, 400);
  }

  // Find the specific goddo from content
  const goddo = doc.content.find((item) => item.metadata?.godID === godID);

  if (!goddo) {
    throw getErrorObj(`Goddo with ID "${godID}" not found in content`, 400);
  }

  // Pull the goddo from content array
  const res = await this.updateOne(
    {
      subcategoryID: subID,
    },
    { $pull: { content: { "metadata.godID": godID } } },
    { session }
  );

  if (res.modifiedCount === 0) {
    throw getErrorObj(
      `Failed to remove goddo "${godID}" from subcategory "${subID}"`,
      500
    );
  }

  // Return the deleted goddo
  return goddo;
};

SubcategorySchema.statics.getIDs = async function () {
  const results = await this.aggregate([
    { $unwind: "$content" }, // Flatten 'content' array
    { $project: { _id: 0, godID: "$content.metadata.godID" } }, // Extract only godIDs
  ]);

  return results.map((item) => item.godID); // all godIDs in one array
};

// Create the model
const Goddo = mongoose.model("Goddo", SubcategorySchema, "goddo");

// Finally export
module.exports = Goddo;
