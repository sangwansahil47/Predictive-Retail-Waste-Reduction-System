import { Router } from "express";
import { ColumnMapping } from "../models/ColumnMapping.model.js";
import { UPLOAD_TYPES } from "../models/Upload.model.js";
import { DATE_FORMATS, validateMapping } from "../utils/csvOptions.js";

const columnMappingRouter = Router();
const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

// GET /api/column-mappings -> { stores: {...}, products: {...}, ... } for this account
columnMappingRouter.get("/", async (req, res) => {
  const saved = await ColumnMapping.find({ owner: req.user.id }).lean();
  const data = Object.fromEntries(
    saved.map(({ type, mapping, separator, dateFormat }) => [type, { mapping, separator, dateFormat }]),
  );
  return res.status(200).json({ success: true, data });
});

// PUT /api/column-mappings/:type  { mapping, separator?, dateFormat? }
columnMappingRouter.put("/:type", async (req, res) => {
  const { type } = req.params;
  if (!UPLOAD_TYPES.includes(type)) throw badRequest("Invalid upload type");
  const mapping = validateMapping(type, req.body?.mapping);
  const separator = typeof req.body?.separator === "string" ? req.body.separator.slice(0, 5) : undefined;
  const dateFormat = DATE_FORMATS.includes(req.body?.dateFormat) ? req.body.dateFormat : undefined;

  const saved = await ColumnMapping.findOneAndUpdate(
    { owner: req.user.id, type },
    { $set: { mapping, separator, dateFormat } },
    { new: true, upsert: true, runValidators: true },
  ).lean();
  return res.status(200).json({ success: true, data: saved });
});

export default columnMappingRouter;
