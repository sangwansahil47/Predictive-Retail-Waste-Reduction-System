import { listUploads, removeUpload } from "../services/upload.service.js";

export const getUploads = async (req, res) => {
  const { type, page, limit } = req.query;
  const result = await listUploads(req.user.id, { type, page, limit });
  return res.status(200).json({ success: true, ...result });
};

export const deleteUpload = async (req, res) => {
  const upload = await removeUpload(req.params.id, req.user);
  return res.status(200).json({
    success: true,
    message: `Removed ${upload.removedCount} ${upload.type} row${upload.removedCount === 1 ? "" : "s"} from ${upload.fileName}.`,
    data: upload,
  });
};
