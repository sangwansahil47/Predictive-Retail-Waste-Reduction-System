import { Router } from "express";
import { getUploads, deleteUpload } from "../controllers/upload.controller.js";

const uploadRouter = Router();

uploadRouter.get("/", getUploads);
uploadRouter.delete("/:id", deleteUpload);

export default uploadRouter;
