import { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import FileDropzone from "../components/FileDropzone.jsx";
import ColumnMatcher from "../components/ColumnMatcher.jsx";
import UploadHistory from "../components/UploadHistory.jsx";
import { extractErrorMessage } from "../api/client.js";
import { uploadStoresCsv } from "../api/stores.js";
import { uploadProductsCsv } from "../api/products.js";
import { uploadInventoryCsv } from "../api/inventory.js";
import { uploadSalesCsv } from "../api/sales.js";
import { getColumnMappings, saveColumnMapping } from "../api/columnMappings.js";
import { readCsvPreview } from "../utils/csvPreview.js";
import { DATE_FIELD_KEYS, guessDateFormat, guessMapping, missingRequiredFields } from "../utils/csvFields.js";

const TABS = [
  { key: "stores", label: "Stores", upload: uploadStoresCsv },
  { key: "products", label: "Products", upload: uploadProductsCsv },
  { key: "inventory", label: "Inventory batches", upload: uploadInventoryCsv },
  { key: "sales", label: "Sales", upload: uploadSalesCsv },
];

function UploadPanel({ tab, saved, onSaved, onUploaded }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});
  const [dateFormat, setDateFormat] = useState("YYYY-MM-DD");
  const [remember, setRemember] = useState(true);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const reset = () => {
    setFile(null);
    setPreview(null);
    setMapping({});
  };

  const handleFileSelected = async (selected) => {
    setError("");
    setResult(null);
    setFile(selected);
    setPreview(null);
    try {
      const parsed = await readCsvPreview(selected);
      const guessed = guessMapping(tab.key, parsed.headers, saved?.mapping);
      const dateValues = DATE_FIELD_KEYS.filter((k) => guessed[k]).flatMap((k) =>
        parsed.rows.map((row) => row[guessed[k]]),
      );
      setPreview(parsed);
      setMapping(guessed);
      setDateFormat(saved?.dateFormat || guessDateFormat(dateValues));
    } catch (err) {
      setError(err.message || "Couldn't read this file.");
      setFile(null);
    }
  };

  const missing = preview ? missingRequiredFields(tab.key, mapping) : [];
  const usesDates = DATE_FIELD_KEYS.some((k) => mapping[k]);

  const handleUpload = async () => {
    if (!file || !preview || missing.length) return;
    setUploading(true);
    setError("");
    setResult(null);
    setProgress(0);
    const csvOptions = {
      mapping,
      separator: preview.separator,
      dateFormat: usesDates ? dateFormat : undefined,
    };
    try {
      const response = await tab.upload(file, setProgress, csvOptions);
      setResult(response);
      reset();
      onUploaded();
      if (remember) {
        saveColumnMapping(tab.key, csvOptions)
          .then(() => onSaved(tab.key, csvOptions))
          .catch(() => {}); // remembering is a convenience; the upload already worked
      }
    } catch (err) {
      setError(extractErrorMessage(err, "Upload failed."));
      onUploaded(); // a failed upload is still recorded in the history
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <p className="mb-4 text-sm text-muted">
        Any CSV export works: after you choose a file, you match its columns to what the app needs.
        {saved && " Your saved matching for this type is applied automatically."}
      </p>

      <FileDropzone onFileSelected={handleFileSelected} disabled={uploading} selectedFileName={file?.name} />

      {preview && (
        <ColumnMatcher
          key={file?.name + file?.lastModified}
          type={tab.key}
          fileName={file.name}
          preview={preview}
          mapping={mapping}
          onMappingChange={setMapping}
          dateFormat={dateFormat}
          onDateFormatChange={setDateFormat}
          remember={remember}
          onRememberChange={setRemember}
          disabled={uploading}
        />
      )}

      {uploading && (
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-card">
            <div className="h-full bg-ink transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted">Uploading... {progress}%</p>
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        {file && !uploading && (
          <Button variant="secondary" onClick={reset}>
            Cancel
          </Button>
        )}
        <Button onClick={handleUpload} disabled={!preview || missing.length > 0} loading={uploading}>
          Upload {tab.label.toLowerCase()}
        </Button>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-5 rounded-md border border-hairline p-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <span className="text-ink">
              <strong className="font-semibold">{result.totalProcessed}</strong> rows imported
            </span>
            <span className={result.totalSkipped > 0 ? "text-amber-700" : "text-muted"}>
              <strong className="font-semibold">{result.totalSkipped}</strong> rows skipped
            </span>
          </div>

          {result.skippedRows?.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Why rows were skipped</p>
              <div className="max-h-56 overflow-y-auto rounded-md border border-hairline-soft">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-soft">
                    <tr>
                      <th className="px-3 py-2 font-medium text-muted">Row</th>
                      <th className="px-3 py-2 font-medium text-muted">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline-soft">
                    {result.skippedRows.map((row) => (
                      <tr key={row.row}>
                        <td className="px-3 py-2 text-ink">#{row.row}</td>
                        <td className="px-3 py-2 text-muted">{row.errors.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.skippedRowsTruncated && (
                <p className="mt-2 text-xs text-muted-soft">Showing the first 50 skipped rows.</p>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function UploadCsv() {
  const [activeTab, setActiveTab] = useState(TABS[0].key);
  const [savedMappings, setSavedMappings] = useState({});
  const [historyKey, setHistoryKey] = useState(0);
  const tab = TABS.find((t) => t.key === activeTab);

  useEffect(() => {
    getColumnMappings().then(setSavedMappings).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-ink">Upload data</h1>
        <p className="mt-1 text-sm text-muted">
          Upload stores and products first, then inventory batches and sales - later uploads reference the SKUs and
          store codes already on file.
        </p>
      </div>

      <div className="flex w-fit flex-wrap gap-1 rounded-full bg-surface-soft p-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === t.key ? "bg-canvas text-ink shadow-soft" : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <UploadPanel
        key={tab.key}
        tab={tab}
        saved={savedMappings[tab.key]}
        onSaved={(type, value) => setSavedMappings((prev) => ({ ...prev, [type]: value }))}
        onUploaded={() => setHistoryKey((k) => k + 1)}
      />

      <UploadHistory key={`history-${tab.key}`} type={tab.key} label={tab.label} refreshKey={historyKey} />
    </div>
  );
}
