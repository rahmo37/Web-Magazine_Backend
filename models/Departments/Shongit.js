/**
 * Department Model
 * * Shongit
 */

const mongoose = require("mongoose");
const { Schema } = mongoose;

// Section Schema
const SectionSchema = new Schema({
  sectionID: { type: String, required: true, unique: true },
  sectionAddedDate: { type: Date, required: true },
  sectionArticle: { type: String, required: false },
  sectionImages: { type: [String], default: [] },
});

const ArticleSchema = new Schema({
  articleCover: { type: String, required: false }, // Optional
  articleName: { type: String, required: false }, // Optional
  articleTrailer: { type: String, default: "" }, // Optional
  aboutArticle: { type: String, default: "" }, // Optional
  mainContent: [SectionSchema], // Sections inside the article
});

const MetadataSchema = new Schema({
  ganID: { type: String, required: true, unique: true },
  ganLink: { type: String, required: false },
  contentAddedDate: { type: Date, required: true },
  originalWritingDate: { type: Date, required: false }, // Optional
});

const SubcategorySchema = new Schema(
  {
    subcategoryID: { type: String, required: true, unique: true },
    subcategoryName: { type: String, required: true },

    // If this subcategory has children
    children: [this],

    // If this subcategory directly stores multiple metadata & articles
    contents: [
      {
        metadata: MetadataSchema,
        article: ArticleSchema,
      },
    ],
  },
  { timestamps: true, collection: "shongit" }
);

// Get all the ganIDs currently in the database
SubcategorySchema.statics.getIDs = async function () {
  // 1) grab only the parts you need
  const roots = await this.find({}, { contents: 1, children: 1, _id: 0 });

  const ganIDs = [];

  // 2) define a recursive helper
  function collect(node) {
    // pull IDs out of this node’s contents
    if (Array.isArray(node.contents)) {
      node.contents.forEach((c) => {
        if (c.metadata?.ganID) {
          ganIDs.push(c.metadata.ganID);
        }
      });
    }
    // Then dive into each child
    if (Array.isArray(node.children)) {
      node.children.forEach((child) => collect(child));
    }
  }

  // 3) start from each root
  roots.forEach((eachRoot) => collect(eachRoot));

  return ganIDs;
};

// Delete many Shongits with ganIDs array
SubcategorySchema.statics.deleteByIDs = async function (ganIDs) {
  if (!Array.isArray(ganIDs) || ganIDs.length === 0) {
    throw new Error("You must provide a non‑empty array of ganIDs");
  }

  // Fetch all subcategories
  const docs = await this.find().exec();
  let totalRemoved = 0,
    docsModified = 0;

  for (const doc of docs) {
    let docChanged = false;

    // 1️⃣ Remove from top‑level contents
    const beforeRoot = doc.contents.length;
    doc.contents = doc.contents.filter(
      (c) => !ganIDs.includes(c.metadata.ganID)
    );
    const removedHere = beforeRoot - doc.contents.length;
    if (removedHere > 0) {
      totalRemoved += removedHere;
      doc.markModified("contents");
      docChanged = true;
    }

    // 2️⃣ Recursively strip from any children
    function stripChildren(nodeArray) {
      if (!Array.isArray(nodeArray)) return;
      for (const sub of nodeArray) {
        const beforeSub = sub.contents.length;
        sub.contents = sub.contents.filter(
          (c) => !ganIDs.includes(c.metadata.ganID)
        );
        const removedSub = beforeSub - sub.contents.length;
        if (removedSub > 0) {
          totalRemoved += removedSub;
          docChanged = true;
        }
        // dive deeper
        stripChildren(sub.children);
      }
    }
    stripChildren(doc.children);

    // 3️⃣ If anything changed, mark and save
    if (docChanged) {
      // because we mutated nested paths, let Mongoose know:
      doc.markModified("children");
      await doc.save();
      docsModified++;
    }
  }

  return { docsModified, totalRemoved };
};

// Creating Model
const Shongit = mongoose.model("Shongit", SubcategorySchema, "shongit");

module.exports = Shongit;
