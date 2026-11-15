import mongoose from "mongoose";
import { Store } from "../models/Store.model.js";

const invalidRequest = (message) => Object.assign(new Error(message), { status: 400 });
const notFound = (message) => Object.assign(new Error(message), { status: 404 });

// Every function is scoped to one account (`ownerId`): it only ever reads or
// changes that account's stores.

export const saveStoreBatch = async (storeBatch, { ownerId, uploadId } = {}) => {
  if (!storeBatch.length) return;
  const docs = storeBatch.map((store) => ({ ...store, owner: ownerId, ...(uploadId && { uploadId }) }));
  return Store.insertMany(docs, { ordered: true });
};

export const addStore = async (storeData, ownerId) => {
  const { name, storeCode, location } = storeData || {};
  return Store.create({ name, storeCode, location, owner: ownerId });
};

export const updateStore = async (id, storeData, ownerId) => {
  if (!mongoose.isValidObjectId(id)) throw invalidRequest("Invalid store ID");
  if (!storeData || typeof storeData !== "object" || Array.isArray(storeData))
    throw invalidRequest("Invalid store update");
  const allowedFields = ["name", "storeCode", "location"];
  const filteredUpdates = Object.fromEntries(
    Object.entries(storeData).filter(([key]) => allowedFields.includes(key)),
  );
  if (Object.keys(filteredUpdates).length === 0)
    throw invalidRequest("No valid fields to update");

  const updatedStore = await Store.findOneAndUpdate(
    { _id: id, owner: ownerId },
    { $set: filteredUpdates },
    { new: true, runValidators: true },
  );
  if (!updatedStore) throw notFound("Store not found");
  return updatedStore;
};

export const deleteStore = async (id, ownerId) => {
  if (!mongoose.isValidObjectId(id)) throw invalidRequest("Invalid store ID");
  const deletedStore = await Store.findOneAndDelete({ _id: id, owner: ownerId });
  if (!deletedStore) throw notFound("Store not found");
  return deletedStore;
};

export const getStore = async (id, ownerId) => {
  if (!mongoose.isValidObjectId(id)) throw invalidRequest("Invalid store ID");
  const store = await Store.findOne({ _id: id, owner: ownerId });
  if (!store) throw notFound("Store not found");
  return store;
};

export const getStores = async (ownerId, filters = {}, options = {}) => {
  const page = Math.max(1, Number.parseInt(options.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(options.limit, 10) || 10));
  const skip = (page - 1) * limit;
  const sort = options.sort || { name: 1 };
  const query = { ...filters, owner: ownerId };
  const [stores, total] = await Promise.all([
    Store.find(query).sort(sort).skip(skip).limit(limit).lean(),
    Store.countDocuments(query),
  ]);
  return { stores, pagination: { total, page, pages: Math.ceil(total / limit), limit } };
};
