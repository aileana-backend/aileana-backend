// helpers/cloudUpload.js
const streamifier = require("streamifier");
const cloudinary = require("../config/cloudinary");

function uploadBufferToCloudinary(
  buffer,
  publicId,
  resource_type = "auto",
  folder = "posts_media"
) {
  return new Promise((resolve, reject) => {
    const options = {
      folder,
      public_id: publicId,
      resource_type, // 'image', 'video', 'raw' or 'auto'
      overwrite: true,
    };

    const stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
}

module.exports = { uploadBufferToCloudinary };
