import { apiClient } from "./client.js";

export const getColumnMappings = () => apiClient.get("/column-mappings").then((r) => r.data.data || {});
export const saveColumnMapping = (type, body) => apiClient.put(`/column-mappings/${type}`, body).then((r) => r.data.data);
