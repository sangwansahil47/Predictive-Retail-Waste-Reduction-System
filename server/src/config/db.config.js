import mongoose from "mongoose";
import env from "./env.js";
import { Store } from "../models/Store.model.js";
import { Product } from "../models/Product.model.js";

// Cached so serverless invocations (Vercel) reuse one connection per warm instance
// instead of reconnecting on every request.
let connectionPromise = null;

export const connectDB = async () => {
  if (!env.mongo_uri) {
    throw new Error("MONGODB_URI is not configured");
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(env.mongo_uri, { serverSelectionTimeoutMS: 8000 })
      .then(async (conn) => {
        console.log("MongoDB connected:", conn.connection.host);
        // Store codes and SKUs used to be unique across the whole app; they are now
        // unique per account. syncIndexes drops the old app-wide unique indexes
        // (storeCode_1, sku_1) and creates the per-account ones.
        try {
          await Promise.all([Store.syncIndexes(), Product.syncIndexes()]);
        } catch (err) {
          console.error("Index sync failed:", err.message);
        }
        return conn;
      })
      .catch((err) => {
        connectionPromise = null; // allow a retry on the next request
        throw err;
      });
  }

  return connectionPromise;
};
