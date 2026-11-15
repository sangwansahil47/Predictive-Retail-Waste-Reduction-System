import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import Button from "./Button.jsx";
import { previewDelete, deleteSelected } from "../api/bulkDelete.js";
import { extractErrorMessage } from "../api/client.js";
import { formatNumber } from "../utils/format.js";

const LABELS = {
  stores: ["store", "stores"],
  products: ["product", "products"],
  batches: ["inventory batch", "inventory batches"],
  sales: ["sales record", "sales records"],
};
const describe = (key, n) => `${formatNumber(n)} ${LABELS[key][n === 1 ? 0 : 1]}`;

/**
 * Confirmation popup for every delete. Asks the server exactly what will go
 * (including linked inventory and sales), shows it, and deletes only on confirm.
 *
 * selection: { stores?, products?, batches?, uploads? } (arrays of ids)
 * primary:   which key the user selected ("stores", "products", "batches" or "uploads")
 * names:     optional names of the selected items, to show a few
 */
export default function ConfirmDeleteModal({ selection, primary, names = [], onClose, onDeleted }) {
  const [preview, setPreview] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    let active = true;
    previewDelete(selection)
      .then((counts) => active && setPreview(counts))
      .catch((err) => active && setLoadError(extractErrorMessage(err, "Couldn't check what will be deleted.")));
    return () => {
      active = false;
    };
  }, [selection]);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      const deleted = await deleteSelected(selection);
      onDeleted(deleted);
    } catch (err) {
      setDeleteError(extractErrorMessage(err, "Couldn't delete. Nothing was changed."));
      setDeleting(false);
    }
  };

  const mainCount = primary === "uploads" ? preview?.uploads : preview?.[primary];
  const mainLabel =
    primary === "uploads"
      ? `${formatNumber(mainCount ?? 0)} upload${mainCount === 1 ? "" : "s"}`
      : describe(primary, mainCount ?? 0);
  // Everything else that goes with it
  const linked = preview
    ? Object.keys(LABELS).filter((key) => key !== primary && preview[key] > 0)
    : [];
  const hasCascade = linked.length > 0;

  return (
    <Modal title="Delete permanently?" onClose={() => !deleting && onClose()}>
      {!preview && !loadError && <p className="py-4 text-sm text-muted">Checking what will be deleted...</p>}

      {loadError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger" role="alert">
          {loadError}
        </p>
      )}

      {preview && (
        <div className="flex flex-col gap-4 text-sm">
          <p className="text-ink">
            You're about to delete <strong>{mainLabel}</strong>
            {names.length > 0 && (
              <span className="text-muted">
                {" "}
                ({names.slice(0, 3).join(", ")}
                {names.length > 3 ? ` and ${formatNumber(names.length - 3)} more` : ""})
              </span>
            )}
            .
          </p>

          {primary === "uploads" && (
            <p className="text-muted">
              The rows these files imported are deleted. The uploads stay in your history marked as removed, and you
              can upload the files again.
            </p>
          )}

          {hasCascade && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
              <p className="font-medium text-red-700">
                {primary === "uploads" ? "This deletes the data from these files:" : "This also deletes data linked to them:"}
              </p>
              <ul className="mt-1.5 list-disc pl-5 text-red-700">
                {linked.map((key) => (
                  <li key={key}>{describe(key, preview[key])}</li>
                ))}
              </ul>
            </div>
          )}

          {primary === "uploads" && preview.sales > 0 && (
            <p className="text-muted">Stock taken by removed sales is added back to the inventory batches.</p>
          )}

          <p className="font-medium text-danger">This can't be undone.</p>
        </div>
      )}

      {deleteError && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-danger" role="alert">
          {deleteError}
        </p>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={deleting}>
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={handleDelete}
          loading={deleting}
          disabled={!preview || (mainCount ?? 0) === 0}
          className="!bg-red-600 !text-white hover:!bg-red-700 !border-red-600"
        >
          {hasCascade ? "Delete all of it" : "Delete"}
        </Button>
      </div>
    </Modal>
  );
}
