import { Router } from "express";
import { previewBulkDelete, bulkDelete } from "../controllers/bulkDelete.controller.js";

const bulkDeleteRouter = Router();

bulkDeleteRouter.post("/preview", previewBulkDelete);
bulkDeleteRouter.post("/", bulkDelete);

export default bulkDeleteRouter;
