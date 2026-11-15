import { apiClient } from "./client.js";

// selection: { stores?: [id], products?: [id], batches?: [id], uploads?: [id] }
export const previewDelete = (selection) => apiClient.post("/bulk-delete/preview", selection).then((r) => r.data.data);
export const deleteSelected = (selection) => apiClient.post("/bulk-delete", selection).then((r) => r.data.deleted);
