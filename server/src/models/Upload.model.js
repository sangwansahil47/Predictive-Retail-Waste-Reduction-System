import mongoose from "mongoose";

export const UPLOAD_TYPES = ["stores", "products", "inventory", "sales"];

// One document per CSV upload. Every row an upload imports is tagged with this
// document's _id (as `uploadId`), so the whole upload can be removed later.
const uploadSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: UPLOAD_TYPES, required: true, index: true },
    fileName: { type: String, required: true, trim: true },
    uploadedBy: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      email: { type: String, trim: true },
    },
    status: {
      type: String,
      enum: ["processing", "completed", "failed", "removed"],
      default: "processing",
      index: true,
    },
    totalProcessed: { type: Number, default: 0 },
    totalSkipped: { type: Number, default: 0 },
    errorMessage: { type: String },
    // Sales uploads only: stock taken from each inventory batch, so removing the
    // upload can put it back.
    stockDeductions: [
      {
        _id: false,
        batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch" },
        quantity: { type: Number, min: 0 },
      },
    ],
    removedAt: { type: Date },
    removedBy: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      email: { type: String, trim: true },
    },
    removedCount: { type: Number },
  },
  { timestamps: true },
);

uploadSchema.index({ owner: 1, type: 1, createdAt: -1 });

export const Upload = mongoose.model("Upload", uploadSchema);
