import { apiClient, appendCsvOptions } from "./client.js";

export const listInventoryBatches = (params = {}) => apiClient.get("/inventory", { params }).then((r) => r.data);
export const createInventoryBatch = (payload) => apiClient.post("/inventory/add", payload).then((r) => r.data.data);
export const updateInventoryBatch = (id, payload) => apiClient.put(`/inventory/${id}`, payload).then((r) => r.data.data);
export const deleteInventoryBatch = (id) => apiClient.delete(`/inventory/${id}`).then((r) => r.data);
export const uploadInventoryCsv = (file, onProgress, csvOptions = {}) => {
  const form = new FormData();
  form.append("file", file);
  appendCsvOptions(form, csvOptions);
  return apiClient
    .post("/inventory/upload", form, {
      onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total || 1))),
    })
    .then((r) => r.data);
};
