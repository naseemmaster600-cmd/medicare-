
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Medicine = {
  id: number;
  name: string;
  dose: string;
  time: string;
  meal: string;
  stock: number;
  daily: number;
  expiry: string;
  taken: boolean;
};

const STORAGE_KEY = "medicare_medicines";
const MEDICINES_EVENT = "medicare-medicines-updated";

export default function AddMedicinePage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [time, setTime] = useState("08:30 PM");
  const [meal, setMeal] = useState("After dinner");
  const [stock, setStock] = useState("18");
  const [daily, setDaily] = useState("1");
  const [expiry, setExpiry] = useState("2027-04-10");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!name.trim() || !dose.trim() || !time || !expiry) {
      setError("Please fill in all required fields.");
      return;
    }

    const stockNumber = Number(stock);
    const dailyNumber = Number(daily);

    if (
      !Number.isFinite(stockNumber) ||
      stockNumber < 0 ||
      !Number.isInteger(stockNumber) ||
      !Number.isFinite(dailyNumber) ||
      dailyNumber < 1 ||
      !Number.isInteger(dailyNumber)
    ) {
      setError("Enter valid stock and doses per day.");
      return;
    }

    setSaving(true);

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      let medicines: Medicine[] = [];

      if (raw) {
        const parsed: unknown = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
          throw new Error("Stored medicine data is invalid.");
        }

        medicines = parsed as Medicine[];
      }

      const newMedicine: Medicine = {
        id: Date.now(),
        name: name.trim(),
        dose: dose.trim(),
        time: time.trim(),
        meal,
        stock: stockNumber,
        daily: dailyNumber,
        expiry,
        taken: false,
      };

      medicines.push(newMedicine);

      // Save first and verify that the browser stored the medicine.
      const json = JSON.stringify(medicines);
      localStorage.setItem(STORAGE_KEY, json);

      const verified = localStorage.getItem(STORAGE_KEY);
      if (!verified || verified !== json) {
        throw new Error("Could not verify saved medicine.");
      }

      window.dispatchEvent(new Event(MEDICINES_EVENT));
      router.push("/");
    } catch {
      setSaving(false);
      setError(
        "Medicine save aagala. Browser storage unavailable or saved data invalid."
      );
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:py-12">
      <main className="mx-auto max-w-2xl">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mb-5 text-sm font-medium text-blue-700 hover:text-blue-900"
        >
          ← Back to Dashboard
        </button>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-8">
          <div className="mb-7">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-2xl">
              💊
            </div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Add Medicine
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Add your medicine details to your MediCare+ schedule.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label htmlFor="medicine-name" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Medicine Name *
              </label>
              <input
                id="medicine-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Example: Omega 3"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="medicine-dose" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Dosage *
              </label>
              <input
                id="medicine-dose"
                required
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                placeholder="Example: 1 capsule"
                className={inputClass}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="medicine-time" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Time *
                </label>
                <input
                  id="medicine-time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  placeholder="08:30 PM"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="medicine-meal" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Meal Timing
                </label>
                <select
                  id="medicine-meal"
                  value={meal}
                  onChange={(e) => setMeal(e.target.value)}
                  className={inputClass}
                >
                  <option>Before breakfast</option>
                  <option>After breakfast</option>
                  <option>Before lunch</option>
                  <option>After lunch</option>
                  <option>Before dinner</option>
                  <option>After dinner</option>
                  <option>With food</option>
                </select>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="medicine-stock" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Available Stock *
                </label>
                <input
                  id="medicine-stock"
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="medicine-daily" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Doses Per Day *
                </label>
                <input
                  id="medicine-daily"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={daily}
                  onChange={(e) => setDaily(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="medicine-expiry" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Expiry Date *
              </label>
              <input
                id="medicine-expiry"
                type="date"
                required
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className={inputClass}
              />
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Medicine"}
              </button>

              <button
                type="button"
                onClick={() => router.push("/")}
                className="rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";