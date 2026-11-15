import mongoose from "mongoose";
import { Product } from "../models/Product.model.js";

const invalidRequest = (message) => Object.assign(new Error(message), { status: 400 });
const notFound = (message) => Object.assign(new Error(message), { status: 404 });

const PRODUCT_FIELDS = ["sku", "name", "category", "costPrice", "sellingPrice", "unit", "shelfLife"];
const pick = (data) =>
  Object.fromEntries(Object.entries(data || {}).filter(([key]) => PRODUCT_FIELDS.includes(key)));

// Every function is scoped to one account (`ownerId`): it only ever reads or
// changes that account's products.

export const saveProductBatch = async (productBatch, { ownerId, uploadId } = {}) => {
  if (!productBatch.length) return;
  const docs = productBatch.map((product) => ({ ...product, owner: ownerId, ...(uploadId && { uploadId }) }));
  return Product.insertMany(docs, { ordered: true });
};

export const saveProduct = async (data, ownerId) => {
  return Product.create({ ...pick(data), owner: ownerId });
};

export const updateProduct = async (id, updateData, ownerId) => {
  if (!mongoose.isValidObjectId(id)) throw invalidRequest("Invalid product ID");
  if (!updateData || typeof updateData !== "object" || Array.isArray(updateData))
    throw invalidRequest("Invalid product update");
  const filteredUpdates = pick(updateData);
  if (Object.keys(filteredUpdates).length === 0)
    throw invalidRequest("No valid fields to update");

  const updatedProduct = await Product.findOneAndUpdate(
    { _id: id, owner: ownerId },
    { $set: filteredUpdates },
    { new: true, runValidators: true },
  );
  if (!updatedProduct) throw notFound("Product not found");
  return updatedProduct;
};

export const deleteProduct = async (id, ownerId) => {
  if (!mongoose.isValidObjectId(id)) throw invalidRequest("Invalid product ID");
  const deletedProduct = await Product.findOneAndDelete({ _id: id, owner: ownerId });
  if (!deletedProduct) throw notFound("Product not found");
  return deletedProduct;
};

export const getProduct = async (id, ownerId) => {
  if (!mongoose.isValidObjectId(id)) throw invalidRequest("Invalid product ID");
  const product = await Product.findOne({ _id: id, owner: ownerId });
  if (!product) throw notFound("Product not found");
  return product;
};

export const getProducts = async (ownerId, filters = {}, options = {}) => {
  const page = Math.max(1, Number.parseInt(options.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(options.limit, 10) || 10));
  const skip = (page - 1) * limit;
  const sort = options.sort || { name: 1 };
  const query = { ...filters, owner: ownerId };
  const [products, total] = await Promise.all([
    Product.find(query).sort(sort).skip(skip).limit(limit).lean(),
    Product.countDocuments(query),
  ]);
  return { products, pagination: { total, page, pages: Math.ceil(total / limit), limit } };
};
