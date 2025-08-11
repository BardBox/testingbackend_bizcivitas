import multer from "multer";
import path from "path";
import fs from "fs";

const baseImageDir = path.join(process.cwd(), "public", "assets", "images");

if (!fs.existsSync(baseImageDir)) {
  fs.mkdirSync(baseImageDir, { recursive: true });
}

export const createUpload = (category) => {
  const validCategories = ["user", "event", "community" ,"companyLogo" , "blog", "meeting","wallFeed","post"];

  if (!validCategories.includes(category)) {
    throw new Error("Invalid category. Must be user, event, or community");
  }

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {

      const imageDir = path.join(baseImageDir, category);

      if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true });
      }

      cb(null, imageDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + "-" + file.originalname);
    },
  });

  return multer({
    storage,
  });
};