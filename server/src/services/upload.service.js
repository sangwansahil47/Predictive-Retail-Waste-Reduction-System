import { Upload, UPLOAD_TYPES } from "../models/Upload.model.js";
import { Store } from "../models/Store.model.js";
import { Product } from "../models/Product.model.js";
import { Batch } from "../models/Batch.model.js";
import { Sale } from "../models/Sale.model.js";

const httpError = (status, message) => Object.assign(new Error(message), { status });

const MODEL_BY_TYPE = { stores: Store, products: Product, inventory: Batch, sales: Sale };

const toActor = (user) => (user ? { id: user.id, email: user.email } : undefined);

/**
 * Records a CSV upload in the history and tags every row it imports with the
 * upload's id. `parse(buffer, onBatch)` is one of the csvParser functions and
 * `save(records, uploadId)` the matching batch-save service.
 */
export const runTrackedUpload = async ({ type, file, user, parse, save, options = {} }) => {
  const ownerId = user.id;
  const upload = await Upload.create({
    owner: ownerId,
    type,
    fileName: file.originalname || "upload.csv",
    uploadedBy: toActor(user),
  });

  try {
    const result = await parse(
      file.buffer,
      (records) => save(records, { ownerId, uploadId: upload._id }),
      options,
    );
    upload.status = "completed";
    upload.totalProcessed = result.totalProcessed;
    upload.totalSkipped = result.totalSkipped;
    await upload.save();
    return { uploadId: upload._id, ...result };
  } catch (error) {
    // Earlier batches of a large file may already be saved. Record how many, so
    // a failed upload can still be removed from the history.
    const saved = await MODEL_BY_TYPE[type].countDocuments({ uploadId: upload._id });
    await Upload.updateOne(
      { _id: upload._id },
      { status: "failed", totalProcessed: saved, errorMessage: error.message },
    );
    throw error;
  }
};

export const listUploads = async (ownerId, { type, page, limit } = {}) => {
  const filters = { owner: ownerId };
  if (type) {
    if (!UPLOAD_TYPES.includes(type)) throw httpError(400, "Invalid upload type");
    filters.type = type;
  }
  const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));

  const [uploads, total] = await Promise.all([
    Upload.find(filters)
      .select("-stockDeductions")
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Upload.countDocuments(filters),
  ]);

  return {
    uploads,
    pagination: { total, page: pageNumber, pages: Math.ceil(total / pageSize), limit: pageSize },
  };
};
