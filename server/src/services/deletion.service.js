import mongoose from "mongoose";
import { Store } from "../models/Store.model.js";
import { Product } from "../models/Product.model.js";
import { Batch } from "../models/Batch.model.js";
import { Sale } from "../models/Sale.model.js";
import { Upload } from "../models/Upload.model.js";

// Deleting is always for one account and always cascades:
// - a store takes its inventory batches and sales with it,
// - a product takes its inventory batches and sales with it,
// - an upload takes the rows it imported (and, for stores/products, what they link to);
//   removing a sales upload also puts back the stock those sales took.
// previewDeletion() counts what deleteSelection() would remove, for the confirmation popup.

const MAX_IDS = 20000;
const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

const toIds = (value, label) => {
  if (value == null) return [];
  if (!Array.isArray(value)) throw badRequest(`${label} must be a list of IDs`);
  if (value.length > MAX_IDS) throw badRequest(`Too many ${label} selected at once`);
  for (const id of value) {
    if (!mongoose.isValidObjectId(id)) throw badRequest(`Invalid ID in ${label}`);
  }
  return [...new Set(value.map(String))].map((id) => new mongoose.Types.ObjectId(id));
};

const readSelection = (selection = {}) => ({
  stores: toIds(selection.stores, "stores"),
  products: toIds(selection.products, "products"),
  batches: toIds(selection.batches, "batches"),
  uploads: toIds(selection.uploads, "uploads"),
});

// Turns a selection into the exact filters for every collection that will lose rows.
const planDeletion = async (ownerId, selection, session) => {
  const owner = new mongoose.Types.ObjectId(String(ownerId));
  const { stores, products, batches, uploads: uploadIds } = readSelection(selection);

  const uploads = uploadIds.length
    ? await Upload.find({ owner, _id: { $in: uploadIds }, status: { $nin: ["removed", "processing"] } })
        .session(session ?? null)
        .lean()
    : [];
  const uploadsOf = (type) => uploads.filter((u) => u.type === type).map((u) => u._id);

  // Stores/products imported by the selected uploads are deleted too.
  const [uploadedStores, uploadedProducts] = await Promise.all([
    uploadsOf("stores").length
      ? Store.find({ owner, uploadId: { $in: uploadsOf("stores") } }).distinct("_id").session(session ?? null)
      : [],
    uploadsOf("products").length
      ? Product.find({ owner, uploadId: { $in: uploadsOf("products") } }).distinct("_id").session(session ?? null)
      : [],
  ]);
  const storeIds = [...stores, ...uploadedStores];
  const productIds = [...products, ...uploadedProducts];

  const linked = [];
  if (storeIds.length) linked.push({ storeId: { $in: storeIds } });
  if (productIds.length) linked.push({ productId: { $in: productIds } });

  const batchOr = [...linked];
  if (batches.length) batchOr.push({ _id: { $in: batches } });
  if (uploadsOf("inventory").length) batchOr.push({ uploadId: { $in: uploadsOf("inventory") } });

  const saleOr = [...linked];
  if (uploadsOf("sales").length) saleOr.push({ uploadId: { $in: uploadsOf("sales") } });

  return {
    uploads,
    salesUploads: uploads.filter((u) => u.type === "sales"),
    filters: {
      stores: storeIds.length ? { owner, _id: { $in: storeIds } } : null,
      products: productIds.length ? { owner, _id: { $in: productIds } } : null,
      batches: batchOr.length ? { owner, $or: batchOr } : null,
      sales: saleOr.length ? { owner, $or: saleOr } : null,
    },
  };
};

const MODELS = { stores: Store, products: Product, batches: Batch, sales: Sale };

export const previewDeletion = async (ownerId, selection) => {
  const plan = await planDeletion(ownerId, selection);
  const counts = {};
  await Promise.all(
    Object.entries(plan.filters).map(async ([key, filter]) => {
      counts[key] = filter ? await MODELS[key].countDocuments(filter) : 0;
    }),
  );
  counts.uploads = plan.uploads.length;
  return counts;
};

export const deleteSelection = async (ownerId, selection, user) => {
  const session = await mongoose.startSession();
  const deleted = { stores: 0, products: 0, batches: 0, sales: 0, uploads: 0 };
  try {
    await session.withTransaction(async () => {
      Object.keys(deleted).forEach((key) => (deleted[key] = 0));
      const plan = await planDeletion(ownerId, selection, session);

      // 1. Put back the stock taken by sales uploads being removed (before the
      //    batches themselves might be deleted; batches already gone are skipped).
      const restock = new Map();
      for (const upload of plan.salesUploads) {
        for (const { batch, quantity } of upload.stockDeductions || []) {
          const key = batch.toString();
          restock.set(key, { batch, quantity: (restock.get(key)?.quantity || 0) + quantity });
        }
      }
      if (restock.size) {
        await Batch.bulkWrite(
          [...restock.values()].map(({ batch, quantity }) => ({
            updateOne: { filter: { _id: batch }, update: { $inc: { quantityRemaining: quantity } } },
          })),
          { session },
        );
      }

      // 2. Delete children before parents.
      for (const key of ["sales", "batches", "products", "stores"]) {
        const filter = plan.filters[key];
        if (!filter) continue;
        const result = await MODELS[key].deleteMany(filter, { session });
        deleted[key] = result.deletedCount;
      }

      // 3. Keep the uploads in the history, marked as removed.
      if (plan.uploads.length) {
        await Upload.updateMany(
          { _id: { $in: plan.uploads.map((u) => u._id) } },
          {
            $set: {
              status: "removed",
              removedAt: new Date(),
              removedBy: user ? { id: user.id, email: user.email } : undefined,
            },
          },
          { session },
        );
        deleted.uploads = plan.uploads.length;
      }
    });
    return deleted;
  } finally {
    await session.endSession();
  }
};
