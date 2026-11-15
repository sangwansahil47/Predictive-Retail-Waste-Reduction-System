import { apiClient, appendCsvOptions } from "./client.js";

export const listProducts = (params = {}) => apiClient.get("/product", { params }).then((r) => r.data);
export const createProduct = (payload) => apiClient.post("/product/add", payload).then((r) => r.data.data);
export const updateProduct = (id, payload) =>
  apiClient.patch(`/product/update/${id}`, payload).then((r) => r.data.data);
export const deleteProduct = (id) => apiClient.delete(`/product/delete/${id}`).then((r) => r.data);
export const uploadProductsCsv = (file, onProgress, csvOptions = {}) => {
  const form = new FormData();
  form.append("file", file);
  appendCsvOptions(form, csvOptions);
  return apiClient
    .post("/product/upload", form, {
      onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total || 1))),
    })
    .then((r) => r.data);
};
