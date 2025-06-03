// In this file we have all the necessary configurations and functions for AWS

// Imports
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

// !  S3Client configurations
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Module Scaffolding
const AwsFunctions = {};

// Upload a single image
AwsFunctions.uploadAnImage = async function (file) {
  const fileName = `${file.originalname}`;
  const params = {
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
  };
  await s3.send(new PutObjectCommand(params));
  return fileName;
};

AwsFunctions.uploadMany = async function (fileNames) {
  const uploadedNames = await Promise.all(
    fileNames.map(AwsFunctions.uploadAnImage)
  );
  return uploadedNames;
};

// A filenames Array will be provided and corresponding files will be delete in s3
// Delete an array of keys from S3 and confirm the outcome
AwsFunctions.deleteMany = async function deleteMany(fileNames = []) {
  if (!Array.isArray(fileNames) || fileNames.length === 0) {
    return { deleted: 0, message: "No files supplied" };
  }

  // Filter out the default user filename if provided
  const filteredFileNames = fileNames.filter(
    (key) => key !== process.env.DEFAULT_USER_FILENAME && key !== process.env.DEFAULT_PLACEHOLDER_FILENAME
  );

  // Parameters to send
  const params = {
    Bucket: BUCKET_NAME,
    Delete: {
      Objects: filteredFileNames.map((Key) => ({ Key })),
    },
  };

  const result = await s3.send(new DeleteObjectsCommand(params));

  // If S3 reports any errors, surface them to the caller
  if (result.Errors && result.Errors.length) {
    const failedKeys = result.Errors.map((e) => e.Key).join(", ");
    throw new Error(`Failed to delete: ${failedKeys}`);
  }

  // Otherwise confirm success
  return result.Deleted.length;
};

AwsFunctions.getPresignedUrl = async function (key) {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
  };
  const command = new GetObjectCommand(params);
  return await getSignedUrl(s3, command, { expiresIn: 60 * 15 });
};

module.exports = AwsFunctions;
