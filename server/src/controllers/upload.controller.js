import mongoose from "mongoose";
import { listUploads } from "../services/upload.service.js";
import { deleteSelection } from "../services/deletion.service.js";

export const getUploads = async (req, res) => {
  const { type, page, limit } = req.query;
  const result = await listUploads(req.user.id, { type, page, limit });
  return res.status(200).json({ success: true, ...result });
};

export const deleteUpload = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid upload ID" });
  }
  const deleted = await deleteSelection(req.user.id, { uploads: [req.params.id] }, req.user);
  if (deleted.uploads === 0) {
    return res.status(404).json({ success: false, message: "Upload not found or already removed" });
  }
  return res.status(200).json({ success: true, deleted });
};
