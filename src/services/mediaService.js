import AWS from "aws-sdk";
import dotenv from "dotenv";

dotenv.config();

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

/**
 * Uploads any file to a given folder in S3
 */
const uploadToS3 = async (file, fileName, folderPath) => {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: `${folderPath}${fileName}`,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  return await s3.upload(params).promise();
};

/**
 * Uploads a thumbnail specifically to 'thumbnails/' folder
 */
const uploadThumbnail = async (thumbnailFile) => {
  const fileName = `thumbnail-${Date.now()}-${thumbnailFile.originalname}`;
  return await uploadToS3(thumbnailFile, fileName, "thumbnails/");
};

export { uploadToS3, uploadThumbnail };
