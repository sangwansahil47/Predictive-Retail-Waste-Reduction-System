import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { listStores, createStore, updateStore } from "../api/stores.js";
import { fetchAll } from "../api/fetchAll.js";
import { extractErrorMessage } from "../api/client.js";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import Input from "../components/Input.jsx";
import Table from "../components/Table.jsx";
import Modal from "../components/Modal.jsx";
import Spinner from "../components/Spinner.jsx";
import EmptyState from "../components/EmptyState.jsx";
import ErrorState from "../components/ErrorState.jsx";
import Checkbox from "../components/Checkbox.jsx";
import SelectionBar from "../components/SelectionBar.jsx";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal.jsx";
import Pagination from "../components/Pagination.jsx";
import useSelection from "../hooks/useSelection.js";
import { formatNumber } from "../utils/format.js";

const PAGE_SIZE = 25;

function StoreForm({ initialValues, onSubmit, onCancel, submitting, serverError }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ defaultValues: initialValues });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input label="Store code" error={errors.storeCode?.message} {...register("storeCode", { required: "Required" })} />
      <Input label="Name" error={errors.name?.message} {...register("name", { required: "Required" })} />
      <Input label="Location" error={errors.location?.message} {...register("location", { required: "Required" })} />

      {serverError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{serverError}</p>}

      <div className="mt-2 flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          Save store
        </Button>
      </div>
    </form>
  );
}

export default function Stores() {
  const [state, setState] = useState({ loading: true, error: null, stores: [] });
  const [modal, setModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(null); // { selection, names }
  const [notice, setNotice] = useState("");

  const load = () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchAll(listStores, "stores")
      .then((stores) => setState({ loading: false, error: null, stores }))
      .catch((error) => setState({ loading: false, error: extractErrorMessage(error), stores: [] }));
  };

  useEffect(load, []);

  const pages = Math.max(1, Math.ceil(state.stores.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const pageItems = useMemo(
    () => state.stores.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [state.stores, currentPage],
  );
  const pageIds = useMemo(() => pageItems.map((s) => s._id), [pageItems]);
  const allIds = useMemo(() => state.stores.map((s) => s._id), [state.stores]);
  const selection = useSelection(pageIds, allIds);
  const { clear: clearSelection } = selection;

  const openDeleteConfirm = () => {
    const byId = new Map(state.stores.map((s) => [s._id, s]));
    setConfirm({
      selection: { stores: selection.selectedIds },
      names: selection.selectedIds.map((id) => byId.get(id)?.name).filter(Boolean),
    });
  };

  const handleDeleted = (deleted) => {
    setConfirm(null);
    clearSelection();
    const extra = [
      deleted.batches && `${formatNumber(deleted.batches)} inventory batches`,
      deleted.sales && `${formatNumber(deleted.sales)} sales records`,
    ].filter(Boolean);
    setNotice(
      `Deleted ${formatNumber(deleted.stores)} store${deleted.stores === 1 ? "" : "s"}` +
        (extra.length ? ` and ${extra.join(" and ")}.` : "."),
    );
    load();
  };

  const handleCreate = async (values) => {
    setSubmitting(true);
    setFormError("");
    try {
      await createStore(values);
      setModal(null);
      load();
    } catch (error) {
      setFormError(extractErrorMessage(error, "Could not save store."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (values) => {
    setSubmitting(true);
    setFormError("");
    try {
      await updateStore(modal.store._id, values);
      setModal(null);
      load();
    } catch (error) {
      setFormError(extractErrorMessage(error, "Could not update store."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl text-ink">Stores</h1>
          <p className="mt-1 text-sm text-muted">{state.stores.length} stores on file</p>
        </div>
        <Button onClick={() => { setFormError(""); setModal({ mode: "create" }); }}>Add store</Button>
      </div>

      {notice && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">
          {notice}
        </p>
      )}

      <SelectionBar
        selection={selection}
        totalCount={state.stores.length}
        pageCount={pageItems.length}
        noun="store"
        onDelete={openDeleteConfirm}
      />

      <Card className="p-0">
        {state.loading ? (
          <Spinner label="Loading stores..." />
        ) : state.error ? (
          <ErrorState message={state.error} onRetry={load} />
        ) : state.stores.length === 0 ? (
          <EmptyState title="No stores found" description="Upload a store CSV or add one manually." />
        ) : (
          <>
          <Table
            columns={[
              <Checkbox
                key="all"
                label="Select all stores on this page"
                checked={selection.allPageSelected}
                indeterminate={selection.somePageSelected}
                onChange={selection.togglePage}
              />,
              "Store code", "Name", "Location", "",
            ]}
          >
            {pageItems.map((s) => (
              <tr key={s._id} className={selection.isSelected(s._id) ? "bg-surface-soft" : ""}>
                <td className="w-10 px-4 py-3">
                  <Checkbox
                    label={`Select ${s.name}`}
                    checked={selection.isSelected(s._id)}
                    onChange={() => selection.toggle(s._id)}
                  />
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted">{s.storeCode}</td>
                <td className="px-4 py-3 font-medium text-ink">{s.name}</td>
                <td className="px-4 py-3 text-muted">{s.location}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      className="text-xs font-medium text-ink underline"
                      onClick={() => { setFormError(""); setModal({ mode: "edit", store: s }); }}
                    >
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
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
          primary="stores"
          names={confirm.names}
          onClose={() => setConfirm(null)}
          onDeleted={handleDeleted}
        />
      )}

      {modal && (
        <Modal title={modal.mode === "create" ? "Add store" : "Edit store"} onClose={() => setModal(null)}>
          <StoreForm
            initialValues={modal.mode === "edit" ? modal.store : { storeCode: "", name: "", location: "" }}
            onSubmit={modal.mode === "create" ? handleCreate : handleUpdate}
            onCancel={() => setModal(null)}
            submitting={submitting}
            serverError={formError}
          />
        </Modal>
      )}
    </div>
  );
}
