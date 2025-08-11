import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
import fs from "fs";

const uploadImageOnCloudinary = async (localFilePath) => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  try {
    if (!localFilePath) return null
    //upload the file on cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
        resource_type: "auto"
    })
    // file has been uploaded successfull
    //console.log("file is uploaded on cloudinary ", response.url);
    fs.unlinkSync(localFilePath)
    return response;

} catch (error) {
    fs.unlinkSync(localFilePath) // remove the locally saved temporary file as the upload operation got failed
    return null;
}
};

const uploadOnCloudinary = async (buffer, fileName) => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  try {
    var imageUrl;
    // Convert buffer into a readable stream
    const bufferStream = new Readable();
    bufferStream.push(buffer);
    bufferStream.push(null); // Push null to indicate the end of the stream

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: "auto",
          public_id: fileName, // Optionally set a public ID
        },
        (error, result) => {
          if (error) {
            console.log("Cloudinary Upload Error:", error);
            reject(error); // Reject the promise if there's an error
          } else {
            console.log("File uploaded to Cloudinary:", result);
            resolve(result); // Resolve the promise with the result (including the URL)
          }
        }
      );

      // Pipe the bufferStream to Cloudinary's upload stream
      bufferStream.pipe(uploadStream);
    });
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    return null;
  }
};

export { uploadOnCloudinary, uploadImageOnCloudinary };
