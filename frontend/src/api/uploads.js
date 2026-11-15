import { apiClient } from "./client.js";

export const listUploads = (params = {}) => apiClient.get("/uploads", { params }).then((r) => r.data);
export const removeUpload = (id) => apiClient.delete(`/uploads/${id}`).then((r) => r.data);
