import { parseProductData } from "../utils/csvParser.js";
import { runTrackedUpload } from "../services/upload.service.js";
import { readCsvOptions } from "../utils/csvOptions.js";
import mongoose from "mongoose";
import { deleteSelection } from "../services/deletion.service.js";
import {
  saveProductBatch,
  saveProduct,
  updateProduct,
  getProduct,
  getProducts,
} from "../services/product.service.js";

export const uploadProductData = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "Please upload a valid CSV file." });
  }
  const result = await runTrackedUpload({
    type: "products",
    file: req.file,
    user: req.user,
    options: readCsvOptions(req, "products"),
    parse: parseProductData,
    save: saveProductBatch,
  });
  return res.status(200).json({ success: true, ...result });
};

export const uploadSingleProduct = async (req, res) => {
  const product = await saveProduct(req.body, req.user.id);
  return res.status(201).json({
    success: true,
    message: "Product added successfully.",
    data: product,
  });
};

export const updateSingleProduct = async (req, res) => {
  const product = await updateProduct(req.params.id, req.body, req.user.id);
  return res.status(200).json({
    success: true,
    message: "Product updated successfully.",
    data: product,
  });
};

export const getSingleProduct = async (req, res) => {
  const product = await getProduct(req.params.id, req.user.id);
  return res.status(200).json({ success: true, data: product });
};

// Also deletes the product's inventory batches and sales.
export const deleteSingleProduct = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid product ID" });
  }
  const deleted = await deleteSelection(req.user.id, { products: [req.params.id] }, req.user);
  if (deleted.products === 0) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }
  return res.status(200).json({ success: true, deleted });
};

export const getAllProducts = async (req, res) => {
  const { page, limit, sortField, sortOrder } = req.query;
  const options = { page, limit };
  if (sortField) {
    const allowedSortFields = ["sku", "name", "category", "costPrice", "sellingPrice", "shelfLife"];
    if (!allowedSortFields.includes(sortField))
      return res.status(400).json({ success: false, message: "Invalid sort field" });
    options.sort = { [sortField]: sortOrder === "desc" ? -1 : 1 };
  }
  const result = await getProducts(req.user.id, {}, options);
  return res.status(200).json({ success: true, ...result });
};
