import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "./Card.jsx";
import Button from "./Button.jsx";
import Badge from "./Badge.jsx";
import Checkbox from "./Checkbox.jsx";
import Pagination from "./Pagination.jsx";
import SelectionBar from "./SelectionBar.jsx";
import ConfirmDeleteModal from "./ConfirmDeleteModal.jsx";
import useSelection from "../hooks/useSelection.js";
import { listUploads } from "../api/uploads.js";
import { fetchAll } from "../api/fetchAll.js";
import { extractErrorMessage } from "../api/client.js";
import { formatNumber } from "../utils/format.js";

const STATUS = {
  completed: { tone: "success", label: "Imported" },
  failed: { tone: "danger", label: "Failed" },
  removed: { tone: "neutral", label: "Deleted" },
  processing: { tone: "warning", label: "Processing" },
};

const formatDateTime = (value) =>
  new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const PAGE_SIZE = 10;
const canDelete = (upload) => upload.status === "completed" || upload.status === "failed";

/** Every CSV uploaded for one data type, with checkboxes to delete uploads. */
export default function UploadHistory({ type, label, refreshKey }) {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setUploads(await fetchAll(listUploads, "uploads", { type }, 100));
    } catch (err) {
      setError(extractErrorMessage(err, "Could not load upload history."));
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const pages = Math.max(1, Math.ceil(uploads.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const pageItems = useMemo(
    () => uploads.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [uploads, currentPage],
  );
  const pageIds = useMemo(() => pageItems.filter(canDelete).map((u) => u._id), [pageItems]);
  const allIds = useMemo(() => uploads.filter(canDelete).map((u) => u._id), [uploads]);
  const selection = useSelection(pageIds, allIds);
  const { clear: clearSelection } = selection;

  const openDeleteConfirm = () => {
    const byId = new Map(uploads.map((u) => [u._id, u]));
    setConfirm({
      selection: { uploads: selection.selectedIds },
      names: selection.selectedIds.map((id) => byId.get(id)?.fileName).filter(Boolean),
    });
  };

  const handleDeleted = (deleted) => {
    setConfirm(null);
    clearSelection();
    setNotice(`Deleted ${formatNumber(deleted.uploads)} upload${deleted.uploads === 1 ? "" : "s"}.`);
    load();
  };

  const noun = label.toLowerCase();

  return (
    <Card>
      <div className="mb-4">
        <h2 className="font-display text-lg text-ink">Upload history</h2>
        <p className="mt-1 text-sm text-muted">
          Every {noun} file uploaded. Deleting an upload removes the rows it imported; the file stays listed here, and
          you can upload it again at any time.
        </p>
      </div>

      {notice && (
        <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">
          {notice}
        </p>
      )}

      <div className="mb-4">
        <SelectionBar
          selection={selection}
          totalCount={allIds.length}
          pageCount={pageIds.length}
          noun="upload"
          onDelete={openDeleteConfirm}
        />
      </div>

      {loading && uploads.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Loading history...</p>
      ) : error ? (
        <div className="flex items-center justify-between gap-3 rounded-md bg-red-50 px-3 py-2 text-sm text-danger">
          <span>{error}</span>
          <Button size="sm" variant="secondary" onClick={load}>
            Retry
          </Button>
        </div>
      ) : uploads.length === 0 ? (
        <p className="rounded-md border border-dashed border-hairline bg-surface-soft py-8 text-center text-sm text-muted">
          No {noun} uploads yet.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-hairline">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-hairline bg-surface-soft">
                  <th className="w-10 px-4 py-3">
                    <Checkbox
                      label="Select all uploads on this page"
                      checked={selection.allPageSelected}
                      indeterminate={selection.somePageSelected}
                      onChange={selection.togglePage}
                      disabled={pageIds.length === 0}
                    />
                  </th>
                  {["File", "Uploaded", "Rows", "Status"].map((col) => (
                    <th key={col} className="whitespace-nowrap px-4 py-3 font-medium text-muted">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline-soft">
                {pageItems.map((upload) => {
                  const status = STATUS[upload.status] ?? STATUS.completed;
                  const selectable = canDelete(upload);
                  return (
                    <tr
                      key={upload._id}
                      className={`${upload.status === "removed" ? "text-muted" : "text-ink"} ${
                        selection.isSelected(upload._id) ? "bg-surface-soft" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <Checkbox
                          label={`Select ${upload.fileName}`}
                          checked={selection.isSelected(upload._id)}
                          onChange={() => selection.toggle(upload._id)}
                          disabled={!selectable}
                        />
                      </td>
                      <td className="max-w-[240px] px-4 py-3">
                        <p className="truncate font-medium" title={upload.fileName}>
                          {upload.fileName}
                        </p>
                        {upload.status === "failed" && upload.errorMessage && (
                          <p className="mt-0.5 text-xs text-danger">{upload.errorMessage}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <p>{formatDateTime(upload.createdAt)}</p>
                        {upload.uploadedBy?.email && <p className="text-xs text-muted">{upload.uploadedBy.email}</p>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <p>{formatNumber(upload.totalProcessed)} imported</p>
                        {upload.totalSkipped > 0 && (
                          <p className="text-xs text-amber-700">{formatNumber(upload.totalSkipped)} skipped</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Badge tone={status.tone}>{status.label}</Badge>
                        {upload.status === "removed" && upload.removedAt && (
                          <p className="mt-1 text-xs text-muted">{formatDateTime(upload.removedAt)}</p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={currentPage} pages={pages} onPageChange={setPage} />
        </>
      )}

      {confirm && (
        <ConfirmDeleteModal
          selection={confirm.selection}
          primary="uploads"
          names={confirm.names}
          onClose={() => setConfirm(null)}
          onDeleted={handleDeleted}
        />
      )}
    </Card>
  );
}
