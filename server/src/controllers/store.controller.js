import { parseStoreData } from "../utils/csvParser.js";
import { runTrackedUpload } from "../services/upload.service.js";
import { readCsvOptions } from "../utils/csvOptions.js";
import mongoose from "mongoose";
import { deleteSelection } from "../services/deletion.service.js";
import {
  saveStoreBatch,
  addStore,
  updateStore,
  getStore,
  getStores,
} from "../services/store.service.js";

export const uploadStoreData = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "Please upload a valid CSV file." });
  }
  const result = await runTrackedUpload({
    type: "stores",
    file: req.file,
    user: req.user,
    options: readCsvOptions(req, "stores"),
    parse: parseStoreData,
    save: saveStoreBatch,
  });
  return res.status(200).json({ success: true, ...result });
};

export const addSingleStore = async (req, res) => {
  const store = await addStore(req.body, req.user.id);
  return res.status(201).json({
    success: true,
    message: "Store added successfully.",
    data: store,
  });
};

export const updateSingleStore = async (req, res) => {
  const store = await updateStore(req.params.id, req.body, req.user.id);
  return res.status(200).json({
    success: true,
    message: "Store updated successfully.",
    data: store,
  });
};

export const getSingleStore = async (req, res) => {
  const store = await getStore(req.params.id, req.user.id);
  return res.status(200).json({ success: true, data: store });
};

// Also deletes the store's inventory batches and sales.
export const deleteSingleStore = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid store ID" });
  }
  const deleted = await deleteSelection(req.user.id, { stores: [req.params.id] }, req.user);
  if (deleted.stores === 0) {
    return res.status(404).json({ success: false, message: "Store not found" });
  }
  return res.status(200).json({ success: true, deleted });
};

export const getAllStores = async (req, res) => {
  const { page, limit, sortField, sortOrder } = req.query;
  const options = { page, limit };
  if (sortField) {
    const allowedSortFields = ["storeCode", "name", "location"];
    if (!allowedSortFields.includes(sortField))
      return res.status(400).json({ success: false, message: "Invalid sort field" });
    options.sort = { [sortField]: sortOrder === "desc" ? -1 : 1 };
  }
  const result = await getStores(req.user.id, {}, options);
  return res.status(200).json({ success: true, ...result });
};
