import { apiClient, appendCsvOptions } from "./client.js";

export const listSales = (params = {}) => apiClient.get("/sale", { params }).then((r) => r.data);
export const uploadSalesCsv = (file, onProgress, csvOptions = {}) => {
  const form = new FormData();
  form.append("file", file);
  appendCsvOptions(form, csvOptions);
  return apiClient
    .post("/sale/upload", form, {
      onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total || 1))),
    })
    .then((r) => r.data);
};
