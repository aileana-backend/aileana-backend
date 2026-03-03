const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const allowedFormats = ["jpg", "png", "jpeg", "mp4", "mp3", "wav"];

// const storage = new CloudinaryStorage({
//   cloudinary,
//   params: async (req, file) => {
//     return {
//       folder: "posts_media",
//       resource_type: "auto",
//       format: file.originalname.split(".").pop(),
//       public_id: `${Date.now()}-${file.originalname}`,
//     };
//   },
// });
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.split(".").pop().toLowerCase();
    if (!allowedFormats.includes(ext)) {
      return cb(new Error("File format not supported"), false);
    }
    cb(null, true);
  },
});

module.exports = upload;
