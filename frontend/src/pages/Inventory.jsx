import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { listInventoryBatches, createInventoryBatch, updateInventoryBatch } from "../api/inventory.js";
import { fetchAll } from "../api/fetchAll.js";
import { listStores } from "../api/stores.js";
import { listProducts } from "../api/products.js";
import { extractErrorMessage } from "../api/client.js";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import Input from "../components/Input.jsx";
import Select from "../components/Select.jsx";
import Table from "../components/Table.jsx";
import Modal from "../components/Modal.jsx";
import Spinner from "../components/Spinner.jsx";
import EmptyState from "../components/EmptyState.jsx";
import ErrorState from "../components/ErrorState.jsx";
import Badge from "../components/Badge.jsx";
import Checkbox from "../components/Checkbox.jsx";
import SelectionBar from "../components/SelectionBar.jsx";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal.jsx";
import Pagination from "../components/Pagination.jsx";
import useSelection from "../hooks/useSelection.js";
import { formatDate, formatNumber } from "../utils/format.js";

const PAGE_SIZE = 25;

const daysUntil = (dateStr) => {
  const diff = (new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000;
  return Math.round(diff);
};

function AddBatchForm({ products, stores, onSubmit, onCancel, submitting, serverError }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ defaultValues: { batchId: "", sku: "", storeCode: "", quantityRemaining: 0, initialQuantity: 0, expirationDate: "", receivedDate: "" } });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input label="Batch ID" error={errors.batchId?.message} {...register("batchId", { required: "Required" })} />
      <div className="grid grid-cols-2 gap-4">
        <Select label="Product" error={errors.sku?.message} {...register("sku", { required: "Required" })}>
          <option value="">Select a product</option>
          {products.map((p) => (
            <option key={p._id} value={p.sku}>
              {p.name} ({p.sku})
            </option>
          ))}
        </Select>
        <Select label="Store" error={errors.storeCode?.message} {...register("storeCode", { required: "Required" })}>
          <option value="">Select a store</option>
          {stores.map((s) => (
            <option key={s._id} value={s.storeCode}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Quantity received"
          type="number"
          error={errors.initialQuantity?.message}
          {...register("initialQuantity", { required: "Required", valueAsNumber: true, min: 0 })}
        />
        <Input
          label="Quantity remaining"
          type="number"
          error={errors.quantityRemaining?.message}
          {...register("quantityRemaining", { required: "Required", valueAsNumber: true, min: 0 })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Received date"
          type="date"
          error={errors.receivedDate?.message}
          {...register("receivedDate", { required: "Required" })}
        />
        <Input
          label="Expiry date"
          type="date"
          error={errors.expirationDate?.message}
          {...register("expirationDate", { required: "Required" })}
        />
      </div>

      {serverError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{serverError}</p>}

      <div className="mt-2 flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          Save batch
        </Button>
      </div>
    </form>
  );
}

function EditBatchForm({ batch, onSubmit, onCancel, submitting, serverError }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      quantityRemaining: batch.quantityRemaining,
      initialQuantity: batch.initialQuantity,
      expirationDate: batch.expirationDate?.slice(0, 10),
      receivedDate: batch.receivedDate?.slice(0, 10),
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Quantity received"
          type="number"
          error={errors.initialQuantity?.message}
          {...register("initialQuantity", { required: "Required", valueAsNumber: true, min: 0 })}
        />
        <Input
          label="Quantity remaining"
          type="number"
          error={errors.quantityRemaining?.message}
          {...register("quantityRemaining", { required: "Required", valueAsNumber: true, min: 0 })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Received date" type="date" error={errors.receivedDate?.message} {...register("receivedDate", { required: "Required" })} />
        <Input label="Expiry date" type="date" error={errors.expirationDate?.message} {...register("expirationDate", { required: "Required" })} />
      </div>

      {serverError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{serverError}</p>}

      <div className="mt-2 flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

export default function Inventory() {
  const [state, setState] = useState({ loading: true, error: null, batches: [] });
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [storeId, setStoreId] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(null); // { selection, names }
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetchAll(listStores, "stores").then(setStores).catch(() => {});
    fetchAll(listProducts, "products").then(setProducts).catch(() => {});
  }, []);

  const load = (selectedStoreId) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchAll(listInventoryBatches, "batches", { storeId: selectedStoreId || undefined, sortField: "expirationDate" })
      .then((batches) => setState({ loading: false, error: null, batches }))
      .catch((error) => setState({ loading: false, error: extractErrorMessage(error), batches: [] }));
  };

  useEffect(() => load(storeId), [storeId]);

  const categoryBySku = useMemo(() => {
    const map = {};
    products.forEach((p) => { map[p.sku] = p.category; });
    return map;
  }, [products]);

  const categories = useMemo(() => [...new Set(products.map((p) => p.category))].sort(), [products]);

  const filtered = useMemo(() => {
    return state.batches.filter((b) => {
      const sku = b.productId?.sku || "";
      const name = b.productId?.name || "";
      const matchesCategory = !category || categoryBySku[sku] === category;
      const matchesSearch =
        !search || name.toLowerCase().includes(search.toLowerCase()) || b.batchId.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [state.batches, category, search, categoryBySku]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const pageItems = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  );
  const pageIds = useMemo(() => pageItems.map((b) => b._id), [pageItems]);
  const allIds = useMemo(() => filtered.map((b) => b._id), [filtered]);
  const selection = useSelection(pageIds, allIds);
  const { clear: clearSelection } = selection;

  // A new search or filter starts from page 1 with nothing ticked, so hidden
  // batches are never deleted by accident.
  useEffect(() => {
    setPage(1);
    clearSelection();
  }, [search, category, storeId, clearSelection]);

  const openDeleteConfirm = () => {
    const byId = new Map(state.batches.map((b) => [b._id, b]));
    setConfirm({
      selection: { batches: selection.selectedIds },
      names: selection.selectedIds.map((id) => byId.get(id)?.batchId).filter(Boolean),
    });
  };

  const handleDeleted = (deleted) => {
    setConfirm(null);
    clearSelection();
    setNotice(`Deleted ${formatNumber(deleted.batches)} inventory batch${deleted.batches === 1 ? "" : "es"}.`);
    load(storeId);
  };

  const handleCreate = async (values) => {
    setSubmitting(true);
    setFormError("");
    try {
      await createInventoryBatch(values);
      setModal(null);
      load(storeId);
    } catch (error) {
      setFormError(extractErrorMessage(error, "Could not save batch."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (values) => {
    setSubmitting(true);
    setFormError("");
    try {
      await updateInventoryBatch(modal.batch._id, values);
      setModal(null);
      load(storeId);
    } catch (error) {
      setFormError(extractErrorMessage(error, "Could not update batch."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl text-ink">Inventory batches</h1>
          <p className="mt-1 text-sm text-muted">Sorted first-expiry-first-out (FEFO)</p>
        </div>
        <Button onClick={() => { setFormError(""); setModal({ mode: "create" }); }}>Add batch</Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input placeholder="Search by product or batch ID" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
        <Select value={storeId} onChange={(e) => setStoreId(e.target.value)} className="sm:max-w-xs">
          <option value="">All stores</option>
          {stores.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="sm:max-w-xs">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      {notice && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">
          {notice}
        </p>
      )}

      <SelectionBar
        selection={selection}
        totalCount={filtered.length}
        pageCount={pageItems.length}
        noun="batch"
        pluralNoun="batches"
        onDelete={openDeleteConfirm}
      />

      <Card className="p-0">
        {state.loading ? (
          <Spinner label="Loading inventory..." />
        ) : state.error ? (
          <ErrorState message={state.error} onRetry={() => load(storeId)} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No inventory batches found" description="Upload an inventory CSV or add a batch manually." />
        ) : (
          <>
          <Table
            columns={[
              <Checkbox
                key="all"
                label="Select all batches on this page"
                checked={selection.allPageSelected}
                indeterminate={selection.somePageSelected}
                onChange={selection.togglePage}
              />,
              "Batch", "Product", "Store", "Qty left", "Received", "Expires", "",
            ]}
          >
            {pageItems.map((b) => {
              const days = daysUntil(b.expirationDate);
              return (
                <tr key={b._id} className={selection.isSelected(b._id) ? "bg-surface-soft" : ""}>
                  <td className="w-10 px-4 py-3">
                    <Checkbox
                      label={`Select batch ${b.batchId}`}
                      checked={selection.isSelected(b._id)}
                      onChange={() => selection.toggle(b._id)}
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{b.batchId}</td>
                  <td className="px-4 py-3 font-medium text-ink">{b.productId?.name || "-"}</td>
                  <td className="px-4 py-3 text-muted">{b.storeId?.name || "-"}</td>
                  <td className="px-4 py-3">{formatNumber(b.quantityRemaining)}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(b.receivedDate)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>{formatDate(b.expirationDate)}</span>
                      {days <= 1 && <Badge tone="danger">{days <= 0 ? "Expired" : "1 day"}</Badge>}
                      {days > 1 && days <= 3 && <Badge tone="warning">{days} days</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        className="text-xs font-medium text-ink underline"
                        onClick={() => { setFormError(""); setModal({ mode: "edit", batch: b }); }}
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
          <div className="px-4 pb-4">
            <Pagination page={currentPage} pages={pages} onPageChange={setPage} />
          </div>
          </>
        )}
      </Card>

      {confirm && (
        <ConfirmDeleteModal
          selection={confirm.selection}
          primary="batches"
          names={confirm.names}
          onClose={() => setConfirm(null)}
          onDeleted={handleDeleted}
        />
      )}

      {modal?.mode === "create" && (
        <Modal title="Add inventory batch" onClose={() => setModal(null)}>
          <AddBatchForm products={products} stores={stores} onSubmit={handleCreate} onCancel={() => setModal(null)} submitting={submitting} serverError={formError} />
        </Modal>
      )}
      {modal?.mode === "edit" && (
        <Modal title="Edit batch" onClose={() => setModal(null)}>
          <EditBatchForm batch={modal.batch} onSubmit={handleUpdate} onCancel={() => setModal(null)} submitting={submitting} serverError={formError} />
        </Modal>
      )}
    </div>
  );
}
