import mongoose from "mongoose";

const storeSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    storeCode: { type: String, required: true, trim: true },
    uploadId: { type: mongoose.Schema.Types.ObjectId, ref: "Upload", index: true },
    name: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

// Store codes are unique per account, not across the whole app.
storeSchema.index({ owner: 1, storeCode: 1 }, { unique: true });

export const Store = mongoose.model("Store", storeSchema);
