import { useState } from "react";
import {
  addCategory,
  getSettings,
  removeCategory,
  updateCategory,
  updateServiceFee,
} from "../../services/settingsService.js";

// Platform settings: service fee + property categories.
export default function AdminSettings() {
  const [, force] = useState(0);
  const refresh = () => force((n) => n + 1);
  const settings = getSettings();

  const [fee, setFee] = useState(
    String(Number((settings.serviceFeeRate * 100).toFixed(2))),
  );
  const [feeMsg, setFeeMsg] = useState({ type: "", text: "" });
  const [newCat, setNewCat] = useState({ label: "", icon: "" });
  const [edit, setEdit] = useState(null); // { id, label, icon }
  const [catError, setCatError] = useState("");

  const saveFee = async (e) => {
    e.preventDefault();
    try {
      await updateServiceFee(Number(fee) / 100);
      setFeeMsg({ type: "ok", text: "Saved ✓ New bookings use this rate." });
    } catch (err) {
      setFeeMsg({ type: "error", text: err.message });
    }
  };

  const run = async (fn) => {
    setCatError("");
    try {
      await fn();
      refresh();
    } catch (err) {
      setCatError(err.message);
    }
  };

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold">Categories & settings</h1>

      <form onSubmit={saveFee} className="card space-y-3">
        <h2 className="font-semibold">Service fee</h2>
        <p className="text-sm text-gray-500">
          Charged to guests on top of the nightly rate. Existing bookings keep
          the fee they were booked with.
        </p>
        <div className="flex items-end gap-3">
          <div>
            <label className="label" htmlFor="fee">
              Percentage
            </label>
            <div className="flex items-center gap-2">
              <input
                id="fee"
                type="number"
                step="0.1"
                min="0"
                max="50"
                className="input w-32"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
              <span>%</span>
            </div>
          </div>
          <button className="btn-primary">Save</button>
        </div>
        {feeMsg.text && (
          <p
            className={`text-sm ${feeMsg.type === "ok" ? "text-green-600" : "text-red-600"}`}
          >
            {feeMsg.text}
          </p>
        )}
      </form>

      <div className="card space-y-4">
        <h2 className="font-semibold">Property categories</h2>
        <ul className="divide-y divide-gray-100">
          {settings.categories.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-3">
              {edit?.id === c.id ? (
                <>
                  <input
                    className="input w-16 py-2 text-center"
                    value={edit.icon}
                    onChange={(e) => setEdit({ ...edit, icon: e.target.value })}
                    aria-label="Icon"
                  />
                  <input
                    className="input flex-1 py-2"
                    value={edit.label}
                    onChange={(e) =>
                      setEdit({ ...edit, label: e.target.value })
                    }
                    aria-label="Name"
                  />
                  <button
                    className="btn-primary px-3 py-2 text-sm"
                    onClick={() =>
                      run(async () => {
                        await updateCategory(c.id, edit);
                        setEdit(null);
                      })
                    }
                  >
                    Save
                  </button>
                  <button className="btn-ghost" onClick={() => setEdit(null)}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="w-8 text-center text-xl">{c.icon}</span>
                  <span className="flex-1 font-medium">{c.label}</span>
                  <span className="text-xs text-gray-400">{c.id}</span>
                  <button
                    className="btn-ghost"
                    onClick={() => setEdit({ ...c })}
                  >
                    Edit
                  </button>
                  <button
                    className="btn-ghost text-red-600"
                    onClick={() =>
                      window.confirm(`Remove "${c.label}"?`) &&
                      run(() => removeCategory(c.id))
                    }
                  >
                    Remove
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>

        <form
          className="flex flex-wrap items-end gap-3 border-t border-gray-100 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await addCategory(newCat);
              setNewCat({ label: "", icon: "" });
            });
          }}
        >
          <div>
            <label className="label" htmlFor="ci">
              Icon
            </label>
            <input
              id="ci"
              className="input w-20 text-center"
              placeholder="🏠"
              value={newCat.icon}
              onChange={(e) => setNewCat({ ...newCat, icon: e.target.value })}
            />
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="label" htmlFor="cn">
              New category
            </label>
            <input
              id="cn"
              className="input"
              placeholder="e.g. Treehouses"
              value={newCat.label}
              onChange={(e) => setNewCat({ ...newCat, label: e.target.value })}
            />
          </div>
          <button className="btn-outline">Add category</button>
        </form>
        {catError && (
          <p className="text-sm text-red-600" role="alert">
            {catError}
          </p>
        )}
      </div>
    </div>
  );
}
