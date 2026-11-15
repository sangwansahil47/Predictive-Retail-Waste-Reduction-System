import { Readable } from "node:stream";
import csv from "csv-parser";
import { validateSalesRow } from "../validations/salesValidator.js";
import { validateInventoryRow } from "../validations/inventoryValidator.js";
import { validateStoreRow } from "../validations/storeValidator.js";
import { validateProductRow } from "../validations/productValidator.js";
import { DATE_FIELDS, normalizeDate } from "./csvOptions.js";

const BATCH_SIZE = 1000;
const MAX_REPORTED_SKIPPED_ROWS = 50;

const stripBom = (header) => header.replace(/^﻿/, "").trim();

// options.mapping: { field: "File column" } - renames the file's columns to the
// field names the validators expect; unmatched columns are dropped.
// options.separator: column separator (default ",").
// options.dateFormat: how dates are written in the file (default YYYY-MM-DD).
const buildCsvParser = ({ mapping, separator } = {}) => {
  const fieldByColumn = mapping
    ? new Map(Object.entries(mapping).map(([field, column]) => [stripBom(column), field]))
    : null;
  return csv({
    separator: separator || ",",
    mapHeaders: ({ header }) => {
      const clean = stripBom(header);
      if (!fieldByColumn) return clean;
      return fieldByColumn.get(clean) ?? null;
    },
  });
};

const normalizeRow = (row, dateFormat) => {
  if (!dateFormat) return row;
  const copy = { ...row };
  for (const field of DATE_FIELDS) {
    if (field in copy) copy[field] = normalizeDate(copy[field], dateFormat);
  }
  return copy;
};

const parseCsv = async (fileBuffer, validator, onBatchParsed, mapData = (data) => data, options = {}) => {
  const source = Readable.from(fileBuffer);
  const parser = source.pipe(buildCsvParser(options));
  source.on("error", (error) => parser.destroy(error));

  let totalProcessed = 0;
  let totalSkipped = 0;
  let rowNumber = 0;
  const skippedRows = [];
  let batchRecords = [];

  try {
    for await (const rawRow of parser) {
      rowNumber += 1;
      const validation = validator(normalizeRow(rawRow, options.dateFormat));
      if (!validation.isValid) {
        totalSkipped += 1;
        if (skippedRows.length < MAX_REPORTED_SKIPPED_ROWS) {
          skippedRows.push({ row: rowNumber, errors: validation.errors });
        }
        continue;
      }

      batchRecords.push(mapData(validation.data));
      if (batchRecords.length === BATCH_SIZE) {
        await onBatchParsed(batchRecords);
        totalProcessed += batchRecords.length;
        batchRecords = [];
      }
    }

    if (batchRecords.length > 0) {
      await onBatchParsed(batchRecords);
      totalProcessed += batchRecords.length;
    }

    return {
      totalProcessed,
      totalSkipped,
      skippedRows,
      skippedRowsTruncated: totalSkipped > skippedRows.length,
    };
  } catch (error) {
    source.destroy();
    parser.destroy();
    throw error;
  }
};

export const parseSalesCsv = (fileBuffer, batchId, onBatchParsed, options) =>
  parseCsv(
    fileBuffer,
    validateSalesRow,
    onBatchParsed,
    (data) => ({
      ...data,
      batchId,
    }),
    options,
  );

export const parseInventoryCsv = (fileBuffer, onBatchParsed, options) =>
  parseCsv(fileBuffer, validateInventoryRow, onBatchParsed, undefined, options);

export const parseStoreData = (fileBuffer, onBatchParsed, options) =>
  parseCsv(fileBuffer, validateStoreRow, onBatchParsed, undefined, options);

export const parseProductData = (fileBuffer, onBatchParsed, options) =>
  parseCsv(fileBuffer, validateProductRow, onBatchParsed, undefined, options);
