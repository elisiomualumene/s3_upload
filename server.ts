import dotenv from "dotenv";
import cors from "cors";
import { S3, PutObjectCommand } from "@aws-sdk/client-s3";
import express, { json } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();

const port = process.env.SERVER_PORT!;

app.use(json());
app.use(cors());

const aws_upload_url = process.env.AWS_UPLOAD_URL!;

const client = new S3({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_PUBLIC_KEY!,
    secretAccessKey: process.env.AWS_PRIVATE_KEY!,
  },
});

const uploader = multer({ dest: "upload/" });

app.get("/", (_req, res) => {
  const file = path.resolve(__dirname, "index.html");
  return res.sendFile(file);
});

app.post("/upload", uploader.single("file"), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      res.status(400).send("The file was not found");
      return;
    }

    const content = fs.readFileSync(file?.path);

    const setupFile = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_SET!,
      Key: `${file?.filename}.${file.mimetype.split("/")[1]}`,
      Body: content,
      ContentType: file?.mimetype,
      ACL: "public-read-write",
    });

    const uploaded = await client.send(setupFile);

    const FileResponse = {
      status: uploaded.$metadata.httpStatusCode,
      message: "the file was uploaded",
      file: {
        host: "AWS",
        link: `${aws_upload_url}${file.filename}.${
          file.mimetype.split("/")[1]
        }`,
      },
      metadata: {
        delay: uploaded.$metadata.totalRetryDelay,
      },
    };

    fs.unlink(path.resolve(__dirname, `upload/${file.filename}`), (err) => {
      if (err) {
        console.log(err.message);
      }
      console.log("[ALERT] temporary file was successfuly unlinked");
    });

    return res.status(200).json(FileResponse);
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ message: "something goes wrong", error: err });
  }
});

app.listen(port, () => {
  console.log(`[SERVER] Server is running on http://localhost:${port}`);
});
