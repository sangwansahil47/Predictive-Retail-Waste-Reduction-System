import { requestProductPrediction } from "../services/prediction.service.js";

export const generatePrediction = async (req, res) => {
  const { storeId, productId, forecastDays, modelType } = req.body || {};
  const result = await requestProductPrediction({
    owner_id: req.user.id,
    store_id: storeId || undefined,
    product_id: productId || undefined,
    forecast_days: forecastDays || undefined,
    model_type: modelType || undefined,
  });
  return res.status(201).json({ success: true, message: result.message, data: result });
};
