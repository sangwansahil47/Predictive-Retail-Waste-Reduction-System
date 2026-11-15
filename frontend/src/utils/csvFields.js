// The fields each CSV type needs, with the other names users' systems commonly
// give those columns. Used to auto-match a file's columns on the upload screen.
// `key` must match the server's field names (server/src/utils/csvOptions.js).

export const CSV_FIELDS = {
  stores: [
    { key: "store_code", label: "Store code", required: true, aliases: ["store", "store id", "branch", "branch code", "outlet", "outlet code", "shop code", "location code"] },
    { key: "name", label: "Store name", required: true, aliases: ["store name", "branch name", "outlet name", "shop name"] },
    { key: "location", label: "Location", required: true, aliases: ["city", "address", "area", "region", "town"] },
  ],
  products: [
    { key: "sku", label: "Product SKU", required: true, aliases: ["item code", "product code", "product id", "item id", "code", "barcode", "article", "article no"] },
    { key: "name", label: "Product name", required: true, aliases: ["product name", "item name", "item", "product", "description"] },
    { key: "category", label: "Category", required: true, aliases: ["group", "department", "dept", "product type", "type"] },
    { key: "cost_price", label: "Cost price", required: true, aliases: ["cost", "purchase price", "buy price", "cp", "unit cost"] },
    { key: "selling_price", label: "Selling price", required: true, aliases: ["price", "sale price", "mrp", "retail price", "sp", "unit price"] },
    { key: "unit", label: "Unit (pcs/kg/g/pack)", required: true, aliases: ["uom", "measure", "unit of measure"] },
    { key: "shelf_life", label: "Shelf life (days)", required: true, aliases: ["shelf life days", "expiry days", "life days", "life"] },
  ],
  inventory: [
    { key: "batch_id", label: "Batch ID", required: true, aliases: ["batch", "batch no", "batch number", "lot", "lot no", "lot number"] },
    { key: "sku", label: "Product SKU", required: true, aliases: ["item code", "product code", "product id", "item id", "code", "barcode"] },
    { key: "store_code", label: "Store code", required: true, aliases: ["store", "store id", "branch", "branch code", "outlet", "outlet code"] },
    { key: "quantity_current", label: "Quantity in stock now", required: true, aliases: ["current qty", "qty on hand", "on hand", "stock", "balance", "remaining", "qty", "quantity"] },
    { key: "quantity_received", label: "Quantity received", required: true, aliases: ["received qty", "qty received", "initial qty", "inward qty", "received quantity"] },
    { key: "expiry_date", label: "Expiry date", required: true, aliases: ["expiry", "exp date", "exp", "best before", "use by", "expiration date"] },
    { key: "received_date", label: "Received date", required: true, aliases: ["received on", "date received", "inward date", "grn date", "received"] },
  ],
  sales: [
    { key: "sku", label: "Product SKU", required: true, aliases: ["item code", "product code", "product id", "item id", "code", "barcode"] },
    { key: "store_code", label: "Store code", required: true, aliases: ["store", "store id", "branch", "branch code", "outlet", "outlet code"] },
    { key: "quantity_sold", label: "Quantity sold", required: true, aliases: ["qty", "quantity", "qty sold", "units sold", "units"] },
    { key: "date", label: "Sale date", required: true, aliases: ["sale date", "bill date", "invoice date", "transaction date", "sold on"] },
    { key: "revenue", label: "Revenue", required: true, aliases: ["amount", "total", "total amount", "net amount", "value", "sales amount", "sales"] },
    { key: "discount_applied", label: "Discount %", required: false, aliases: ["discount", "disc", "discount percent", "disc %", "discount %"] },
  ],
};

export const DATE_FIELD_KEYS = ["expiry_date", "received_date", "date"];

export const DATE_FORMATS = [
  { value: "YYYY-MM-DD", label: "Year-Month-Day (2026-11-15)" },
  { value: "DD/MM/YYYY", label: "Day/Month/Year (15/11/2026)" },
  { value: "MM/DD/YYYY", label: "Month/Day/Year (11/15/2026)" },
];

export const normalizeHeader = (value) =>
  String(value ?? "")
    .replace(/^﻿/, "")
    .toLowerCase()
    .replace(/%/g, "percent")
    .replace(/[^a-z0-9]/g, "");

/**
 * Picks a file column for each field: a previously saved match first, then the
 * field's own name, then its common alternative names. A column is used once.
 */
export const guessMapping = (type, headers, saved = {}) => {
  const fields = CSV_FIELDS[type];
  const used = new Set();
  const mapping = {};
  const byNormalized = new Map(headers.map((h) => [normalizeHeader(h), h]));

  const take = (field, column) => {
    if (!column || used.has(column)) return false;
    mapping[field.key] = column;
    used.add(column);
    return true;
  };

  // Pass 1: saved matching, if that column is in this file
  for (const field of fields) {
    if (saved[field.key] && headers.includes(saved[field.key])) take(field, saved[field.key]);
  }
  // Pass 2: exact field name (files already in the app's format)
  for (const field of fields) {
    if (!mapping[field.key]) take(field, byNormalized.get(normalizeHeader(field.key)));
  }
  // Pass 3: label and alternative names
  for (const field of fields) {
    if (mapping[field.key]) continue;
    for (const name of [field.label, ...field.aliases]) {
      if (take(field, byNormalized.get(normalizeHeader(name)))) break;
    }
  }
  return mapping;
};

/** Which required fields still have no column. */
export const missingRequiredFields = (type, mapping) =>
  CSV_FIELDS[type].filter((f) => f.required && !mapping[f.key]);

/** Guesses how dates are written from a few example values. */
export const guessDateFormat = (values) => {
  const samples = values.map((v) => String(v ?? "").trim()).filter(Boolean);
  if (samples.length === 0) return "YYYY-MM-DD";
  if (samples.every((v) => /^\d{4}-\d{1,2}-\d{1,2}/.test(v))) return "YYYY-MM-DD";
  const parts = samples
    .map((v) => /^(\d{1,2})[/.-](\d{1,2})[/.-]\d{2,4}/.exec(v))
    .filter(Boolean)
    .map((m) => [Number(m[1]), Number(m[2])]);
  if (parts.some(([, second]) => second > 12)) return "MM/DD/YYYY";
  if (parts.length) return "DD/MM/YYYY"; // most common outside the US, incl. India
  return "YYYY-MM-DD";
};
