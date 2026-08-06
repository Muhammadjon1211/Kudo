import multer from "multer";
import fs from "fs";
import path from "path";
import { v4 } from "uuid";

const makeUploader = (address: string) => {
    const destination = `./uploads/${address}`;

    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            fs.mkdirSync(destination, { recursive: true });
            cb(null, destination);
        },
        filename: function (req, file, cb) {
            cb(null, v4() + path.parse(file.originalname).ext);
        },
    });

    return multer({ storage: storage });
};

export default makeUploader;
