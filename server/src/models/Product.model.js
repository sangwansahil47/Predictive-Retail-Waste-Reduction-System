import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sku: { type: String, required: true, trim: true },
    uploadId: { type: mongoose.Schema.Types.ObjectId, ref: "Upload", index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, index: true, trim: true },
    costPrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: ["pcs", "kg", "g", "pack"], default: "pcs" },
    shelfLife: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },
  },
  { timestamps: true },
);

// SKUs are unique per account, not across the whole app.
productSchema.index({ owner: 1, sku: 1 }, { unique: true });

export const Product = mongoose.model("Product", productSchema);
