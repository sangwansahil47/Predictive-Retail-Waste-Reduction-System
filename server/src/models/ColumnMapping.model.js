import mongoose from "mongoose";
import { UPLOAD_TYPES } from "./Upload.model.js";

// The column matching an account saved for one CSV type, so its next file from
// the same system is matched automatically.
const columnMappingSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: UPLOAD_TYPES, required: true },
    mapping: { type: Map, of: String, default: {} },
    separator: { type: String },
    dateFormat: { type: String },
  },
  { timestamps: true },
);

columnMappingSchema.index({ owner: 1, type: 1 }, { unique: true });

export const ColumnMapping = mongoose.model("ColumnMapping", columnMappingSchema);
