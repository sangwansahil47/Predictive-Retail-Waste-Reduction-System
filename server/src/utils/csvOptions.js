// Users' systems export CSVs with their own column names, separators and date
// formats. The upload screen sends how the file's columns match the fields the
// app needs; this module validates that and turns it into parser options.

export const CSV_FIELDS = {
  stores: ["store_code", "name", "location"],
  products: ["sku", "name", "category", "cost_price", "selling_price", "unit", "shelf_life"],
  inventory: [
    "batch_id",
    "sku",
    "store_code",
    "quantity_current",
    "quantity_received",
    "expiry_date",
    "received_date",
  ],
  sales: ["sku", "store_code", "quantity_sold", "date", "revenue", "discount_applied"],
};

export const DATE_FIELDS = new Set(["expiry_date", "received_date", "date"]);
export const DATE_FORMATS = ["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"];
const SEPARATORS = new Map([
  [",", ","],
  [";", ";"],
  ["tab", "\t"],
  ["\t", "\t"],
  ["|", "|"],
]);

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

/** Validates a { field: "File column" } object for one upload type. */
export const validateMapping = (type, mapping) => {
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
    throw badRequest("Column matching must be an object");
  }
  const allowed = CSV_FIELDS[type];
  const clean = {};
  for (const [field, column] of Object.entries(mapping)) {
    if (!allowed.includes(field)) throw badRequest(`Unknown field "${field}" for ${type}`);
    if (column == null || column === "") continue;
    if (typeof column !== "string" || column.length > 200) {
      throw badRequest(`Invalid column for "${field}"`);
    }
    clean[field] = column;
  }
  const columns = Object.values(clean);
  if (new Set(columns).size !== columns.length) {
    throw badRequest("The same file column is matched to more than one field");
  }
  return clean;
};

/** Reads the optional mapping/separator/dateFormat fields sent with a CSV upload. */
export const readCsvOptions = (req, type) => {
  const body = req.body || {};
  const options = {};

  if (body.mapping) {
    let parsed;
    try {
      parsed = typeof body.mapping === "string" ? JSON.parse(body.mapping) : body.mapping;
    } catch {
      throw badRequest("Column matching is not valid JSON");
    }
    options.mapping = validateMapping(type, parsed);
  }

  if (body.separator) {
    const separator = SEPARATORS.get(body.separator);
    if (!separator) throw badRequest("Unsupported column separator");
    options.separator = separator;
  }

  if (body.dateFormat) {
    if (!DATE_FORMATS.includes(body.dateFormat)) throw badRequest("Unsupported date format");
    options.dateFormat = body.dateFormat;
  }

  return options;
};

/** Converts a date written in `format` to YYYY-MM-DD; returns the input unchanged if it doesn't fit. */
export const normalizeDate = (value, format) => {
  if (value == null || !format || format === "YYYY-MM-DD") return value;
  const text = String(value).trim();
  const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:[ T].*)?$/.exec(text);
  if (!match) return value;
  let [, first, second, year] = match;
  if (year.length === 2) year = `20${year}`;
  const [day, month] = format === "DD/MM/YYYY" ? [first, second] : [second, first];
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};
