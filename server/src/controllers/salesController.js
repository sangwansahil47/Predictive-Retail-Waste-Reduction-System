import { parseSalesCsv } from "../utils/csvParser.js";
import { runTrackedUpload } from "../services/upload.service.js";
import { saveSalesBatch, getSales as getSalesPage } from "../services/salesService.js";

export const uploadSalesCsv = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: "Please upload a valid CSV File.",
    });
  }
  const batchId = `batch-${Date.now()}`;
  const result = await runTrackedUpload({
    type: "sales",
    file: req.file,
    user: req.user,
    parse: (buffer, onBatch) => parseSalesCsv(buffer, batchId, onBatch),
    save: saveSalesBatch,
  });
  return res.status(200).json({ success: true, batchId, ...result });
};

export const getSales = async (req, res) => {
  const { storeId, productId, page, limit, sortField, sortOrder } = req.query;
  const filters = {};
  if (storeId) filters.storeId = storeId;
  if (productId) filters.productId = productId;
  const options = { page, limit };
  if (sortField) {
    const allowedSortFields = ["date", "quantitySold", "totalAmount"];
    if (!allowedSortFields.includes(sortField))
      return res.status(400).json({ success: false, message: "Invalid sort field" });
    options.sort = { [sortField]: sortOrder === "asc" ? 1 : -1 };
  }
  const result = await getSalesPage(req.user.id, filters, options);
  return res.status(200).json({ success: true, ...result });
};
