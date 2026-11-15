import mongoose from "mongoose";
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
export const runTrackedUpload = async ({ type, file, user, parse, save }) => {
  const ownerId = user.id;
  const upload = await Upload.create({
    owner: ownerId,
    type,
    fileName: file.originalname || "upload.csv",
    uploadedBy: toActor(user),
  });

  try {
    const result = await parse(file.buffer, (records) =>
      save(records, { ownerId, uploadId: upload._id }),
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

// Stores and products are referenced by inventory and sales, so they can only be
// removed once nothing uses them any more.
const assertNotReferenced = async (upload) => {
  if (upload.type !== "stores" && upload.type !== "products") return;

  const Model = MODEL_BY_TYPE[upload.type];
  const ids = await Model.find({ uploadId: upload._id }).distinct("_id");
  if (ids.length === 0) return;

  const field = upload.type === "stores" ? "storeId" : "productId";
  const [batches, sales] = await Promise.all([
    Batch.countDocuments({ owner: upload.owner, [field]: { $in: ids } }),
    Sale.countDocuments({ owner: upload.owner, [field]: { $in: ids } }),
  ]);
  if (batches === 0 && sales === 0) return;

  const used = [
    batches > 0 && `${batches} inventory batch${batches === 1 ? "" : "es"}`,
    sales > 0 && `${sales} sales record${sales === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(" and ");
  throw httpError(
    409,
    `Can't remove these ${upload.type}: ${used} still use them. Remove those inventory and sales uploads first.`,
  );
};

const removeSalesUpload = async (upload) => {
  const session = await mongoose.startSession();
  try {
    let removedCount = 0;
    await session.withTransaction(async () => {
      const result = await Sale.deleteMany({ uploadId: upload._id }, { session });
      removedCount = result.deletedCount;

      // Put back the stock these sales took. Batches removed since then are skipped.
      const totals = new Map();
      for (const { batch, quantity } of upload.stockDeductions || []) {
        const key = batch.toString();
        totals.set(key, { batch, quantity: (totals.get(key)?.quantity || 0) + quantity });
      }
      const operations = [...totals.values()].map(({ batch, quantity }) => ({
        updateOne: { filter: { _id: batch }, update: { $inc: { quantityRemaining: quantity } } },
      }));
      if (operations.length > 0) await Batch.bulkWrite(operations, { session });
    });
    return removedCount;
  } finally {
    await session.endSession();
  }
};

export const removeUpload = async (id, user) => {
  const ownerId = user.id;
  if (!mongoose.isValidObjectId(id)) throw httpError(400, "Invalid upload ID");

  const upload = await Upload.findOne({ _id: id, owner: ownerId });
  if (!upload) throw httpError(404, "Upload not found");
  if (upload.status === "removed") throw httpError(400, "This upload has already been removed");
  if (upload.status === "processing") throw httpError(409, "This upload is still being processed");

  await assertNotReferenced(upload);

  const removedCount =
    upload.type === "sales"
      ? await removeSalesUpload(upload)
      : (await MODEL_BY_TYPE[upload.type].deleteMany({ uploadId: upload._id })).deletedCount;

  upload.status = "removed";
  upload.removedAt = new Date();
  upload.removedBy = toActor(user);
  upload.removedCount = removedCount;
  await upload.save();

  const result = upload.toObject();
  delete result.stockDeductions;
  return result;
};
