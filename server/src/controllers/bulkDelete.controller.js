import { previewDeletion, deleteSelection } from "../services/deletion.service.js";

// Body for both: { stores?: [id], products?: [id], batches?: [id], uploads?: [id] }

export const previewBulkDelete = async (req, res) => {
  const counts = await previewDeletion(req.user.id, req.body);
  return res.status(200).json({ success: true, data: counts });
};

export const bulkDelete = async (req, res) => {
  const deleted = await deleteSelection(req.user.id, req.body, req.user);
  return res.status(200).json({ success: true, deleted });
};
