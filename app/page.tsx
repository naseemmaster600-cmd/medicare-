"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Medicine = {
  id: number;
  name: string;
  dosage: string;
  time: string;
  times?: string[];
  stock: number;
  taken: boolean;
};

type HistoryItem = {
  id: number;
  medicine_id: number;
  medicine_name: string;
  scheduled_time: string;
  status: string;
  recorded_at: string;
  dose_date: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type Page =
  | "dashboard"
  | "medicines"
  | "analytics"
  | "alerts"
  | "history"
  | "assistant"
  | "settings";

const getDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const getScheduledTimes = (medicine: Medicine): string[] => {
  if (medicine.times?.length) return medicine.times;
  return medicine.time ? [medicine.time] : [];
};

const formatTime = (time: string) => {
  if (!time) return "";

  const [hourString, minute] = time.split(":");
  const hour = Number(hourString);

  if (!Number.isFinite(hour) || !minute) return time;

  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${String(displayHour).padStart(2, "0")}:${minute} ${period}`;
};

const convert12HourTo24Hour = (
  hour: string,
  minute: string,
  period: "AM" | "PM",
) => {
  let h = Number(hour);

  if (period === "AM" && h === 12) h = 0;
  if (period === "PM" && h !== 12) h += 12;

  return `${String(h).padStart(2, "0")}:${minute}`;
};

const card =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
const muted = "text-sm text-slate-500";

function ProgressRing({
  value,
  label,
  color = "#10b981",
  size = 150,
}: {
  value: number;
  label: string;
  color?: string;
  size?: number;
}) {
  const safeValue = Math.min(100, Math.max(0, value));
  const stroke = 11;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}: ${safeValue}%`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - safeValue / 100)}
          className="transition-all duration-700"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tracking-tight text-slate-900">
          {safeValue}%
        </span>
        <span className="mt-1 text-xs text-slate-500">{label}</span>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();

  const [page, setPage] = useState<Page>("dashboard");
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");
  const [initializing, setInitializing] = useState(true);

  const [newName, setNewName] = useState("");
  const [newDosage, setNewDosage] = useState("");
  const [newHour, setNewHour] = useState("09");
  const [newMinute, setNewMinute] = useState("00");
  const [newPeriod, setNewPeriod] = useState<"AM" | "PM">("AM");
  const [newTimes, setNewTimes] = useState<string[]>([]);
  const [newStock, setNewStock] = useState("30");

  const [aiQuestion, setAiQuestion] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [savingMedicine, setSavingMedicine] = useState(false);
  const [busyMedicineId, setBusyMedicineId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [loggingOut, setLoggingOut] = useState(false);

  const loadData = useCallback(async (uid: string) => {
    const [medicineResult, historyResult] = await Promise.all([
      supabase
        .from("medicines")
        .select("id, name, dosage, time, times, stock, taken")
        .eq("user_id", uid)
        .order("id", { ascending: false }),

      supabase
        .from("medicine_history")
        .select(
          "id, medicine_id, medicine_name, scheduled_time, status, recorded_at, dose_date",
        )
        .eq("user_id", uid)
        .order("recorded_at", { ascending: false }),
    ]);

    if (medicineResult.error) {
      setNotice(medicineResult.error.message);
    } else {
      setMedicines((medicineResult.data ?? []) as Medicine[]);
    }

    if (historyResult.error) {
      setNotice(historyResult.error.message);
    } else {
      setHistory((historyResult.data ?? []) as HistoryItem[]);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      const { data, error } = await supabase.auth.getUser();

      if (!active) return;

      if (error || !data.user) {
        router.replace("/login");
        return;
      }

      const uid = data.user.id;
      setUserId(uid);

      setUserName(
        data.user.user_metadata?.full_name ||
          data.user.user_metadata?.name ||
          data.user.email?.split("@")[0] ||
          "User",
      );

      await loadData(uid);

      if (active) setInitializing(false);
    };

    initialize();

    return () => {
      active = false;
    };
  }, [loadData, router]);

  const addTime = () => {
    const time = convert12HourTo24Hour(newHour, newMinute, newPeriod);

    setNewTimes((previous) =>
      previous.includes(time) ? previous : [...previous, time].sort(),
    );
  };

  const removeTime = (time: string) => {
    setNewTimes((previous) => previous.filter((item) => item !== time));
  };

  const addMedicine = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("");

    if (!newName.trim() || !newDosage.trim()) {
      setNotice("Enter the medicine name and dosage.");
      return;
    }

    if (newTimes.length === 0) {
      setNotice("Add at least one reminder time.");
      return;
    }

    const stock = Number(newStock);

    if (!Number.isFinite(stock) || stock < 0) {
      setNotice("Enter a valid stock quantity.");
      return;
    }

    setSavingMedicine(true);

    const { error } = await supabase.from("medicines").insert({
      user_id: userId,
      name: newName.trim(),
      dosage: newDosage.trim(),
      time: newTimes[0],
      times: newTimes,
      stock,
      taken: false,
    });

    if (error) {
      setNotice(error.message);
    } else {
      setNewName("");
      setNewDosage("");
      setNewHour("09");
      setNewMinute("00");
      setNewPeriod("AM");
      setNewTimes([]);
      setNewStock("30");
      setNotice("Medicine added successfully.");
      await loadData(userId);
    }

    setSavingMedicine(false);
  };

  const deleteMedicine = async (medicineId: number) => {
    if (!window.confirm("Delete this medicine?")) return;

    setBusyMedicineId(medicineId);

    const { error } = await supabase
      .from("medicines")
      .delete()
      .eq("id", medicineId)
      .eq("user_id", userId);

    if (error) {
      setNotice(error.message);
    } else {
      setMedicines((previous) =>
        previous.filter((medicine) => medicine.id !== medicineId),
      );
      setNotice("Medicine deleted.");
    }

    setBusyMedicineId(null);
  };

  const recordDose = async (
    medicine: Medicine,
    scheduledTime: string,
    status: "taken" | "missed",
  ) => {
    setBusyMedicineId(medicine.id);
    setNotice("");

    const today = getDateKey();

    const { error } = await supabase.from("medicine_history").insert({
      user_id: userId,
      medicine_id: medicine.id,
      medicine_name: medicine.name,
      scheduled_time: scheduledTime,
      status,
      recorded_at: new Date().toISOString(),
      dose_date: today,
    });

    if (error) {
      setNotice(error.message);
    } else {
      await loadData(userId);

      if (status === "taken" && medicine.stock > 0) {
        const { error: stockError } = await supabase
          .from("medicines")
          .update({ stock: medicine.stock - 1 })
          .eq("id", medicine.id)
          .eq("user_id", userId);

        if (stockError) setNotice(stockError.message);
      }

      await loadData(userId);
      setNotice(
        status === "taken" ? "Dose marked as taken." : "Dose marked missed.",
      );
    }

    setBusyMedicineId(null);
  };

  const enableNotifications = async () => {
    if (!("Notification" in window)) {
      setNotice("Notifications are not supported by this browser.");
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      setNotificationsEnabled(true);
      setNotice("Medicine reminders enabled.");
      new Notification("MediCare+", {
        body: "Medicine reminders are now enabled.",
      });
    } else {
      setNotice("Notification permission was not granted.");
    }
  };

  useEffect(() => {
    if (
      !notificationsEnabled ||
      !userId ||
      typeof window === "undefined" ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    ) {
      return;
    }

    const checkReminders = () => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes(),
      ).padStart(2, "0")}`;
      const today = getDateKey();

      for (const medicine of medicines) {
        for (const scheduledTime of getScheduledTimes(medicine)) {
          if (scheduledTime !== currentTime) continue;

          const key = `medicare-reminder-${today}-${medicine.id}-${scheduledTime}`;

          if (sessionStorage.getItem(key)) continue;

          const alreadyRecorded = history.some(
            (item) =>
              item.medicine_id === medicine.id &&
              item.dose_date === today &&
              item.scheduled_time === scheduledTime,
          );

          if (alreadyRecorded) {
            sessionStorage.setItem(key, "1");
            continue;
          }

          new Notification(`Time to take ${medicine.name}`, {
            body: `${medicine.dosage} · ${formatTime(scheduledTime)}`,
          });

          sessionStorage.setItem(key, "1");
        }
      }
    };

    checkReminders();

    const interval = window.setInterval(checkReminders, 15000);
    return () => window.clearInterval(interval);
  }, [notificationsEnabled, userId, medicines, history]);

  const askAssistant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const question = aiQuestion.trim();
    if (!question || aiLoading) return;

    const nextChat: ChatMessage[] = [
      ...chat,
      { role: "user", content: question },
    ];

    setChat(nextChat);
    setAiQuestion("");
    setAiLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          messages: nextChat,
          medicines,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to get a response.");
      }

      setChat((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            result.answer || result.message || "I couldn't generate a response.",
        },
      ]);
    } catch (error) {
      setChat((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  const logout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const today = getDateKey();
  const todayHistory = history.filter((item) => item.dose_date === today);
  const takenToday = todayHistory.filter(
    (item) => item.status === "taken",
  ).length;
  const missedToday = todayHistory.filter(
    (item) => item.status === "missed",
  ).length;

  const totalScheduledToday = medicines.reduce(
    (total, medicine) => total + getScheduledTimes(medicine).length,
    0,
  );

  const lowStock = medicines.filter((medicine) => medicine.stock <= 5);

  const recordedToday = todayHistory.length;
  const adherence =
    recordedToday > 0
      ? Math.round((takenToday / recordedToday) * 100)
      : 0;

  const pendingToday = Math.max(
    totalScheduledToday - recordedToday,
    0,
  );

  const adherenceColor =
    adherence >= 80 ? "#10b981" : adherence >= 50 ? "#f59e0b" : "#ef4444";

  const navItems: { id: Page; label: string; icon: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: "⌂" },
    { id: "medicines", label: "Medicines", icon: "✚" },
    { id: "analytics", label: "Analytics", icon: "▥" },
    { id: "alerts", label: "Alerts", icon: "♧" },
    { id: "history", label: "History", icon: "◷" },
    { id: "assistant", label: "AI Assistant", icon: "✧" },
    { id: "settings", label: "Settings", icon: "⚙" },
  ];

  const recentHistory = history.slice(0, 6);

  if (initializing) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-500" />
          Loading MediCare+...
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 md:flex">
      <aside className="w-full border-b border-slate-200 bg-white p-5 md:min-h-screen md:w-64 md:border-b-0 md:border-r">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-xl font-bold text-white">
              M+
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                MediCare+
              </h1>
              <p className="text-xs text-slate-500">Your health companion</p>
            </div>
          </div>
        </div>

        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Workspace
        </p>

        <nav className="grid grid-cols-2 gap-2 md:grid-cols-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                page === item.id
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="mr-2 text-lg">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-8 hidden rounded-2xl border border-slate-200 bg-slate-50 p-4 md:block">
          <p className="text-xs text-slate-500">SIGNED IN AS</p>
          <p className="mt-2 break-words text-sm font-semibold text-slate-800">
            {userName}
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Account active
          </div>
        </div>

        <button
          onClick={logout}
          disabled={loggingOut}
          className="mt-5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {loggingOut ? "Signing out..." : "Sign out"}
        </button>
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              {page === "dashboard"
                ? `Welcome back, ${userName}`
                : navItems.find((item) => item.id === page)?.label}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {page === "dashboard"
                ? "Here is your health and medication overview."
                : "Manage your medication routine and health records."}
            </p>
          </div>

          <button
            onClick={enableNotifications}
            className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            {notificationsEnabled ? "✓ Reminders enabled" : "Enable reminders"}
          </button>
        </header>

        {notice && (
          <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <span>{notice}</span>
            <button
              onClick={() => setNotice("")}
              className="font-bold"
              aria-label="Dismiss notice"
            >
              ×
            </button>
          </div>
        )}

        {page === "dashboard" && (
          <section className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Total medicines",
                  value: medicines.length,
                  detail: "Medicine records",
                  icon: "✚",
                  tone: "bg-blue-50 text-blue-700",
                },
                {
                  label: "Scheduled doses",
                  value: totalScheduledToday,
                  detail: "Planned for today",
                  icon: "◷",
                  tone: "bg-violet-50 text-violet-700",
                },
                {
                  label: "Doses taken",
                  value: takenToday,
                  detail: `${missedToday} marked missed`,
                  icon: "✓",
                  tone: "bg-emerald-50 text-emerald-700",
                },
                {
                  label: "Low stock",
                  value: lowStock.length,
                  detail: "Need attention",
                  icon: "!",
                  tone: "bg-amber-50 text-amber-700",
                },
              ].map((stat) => (
                <div key={stat.label} className={card}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className={muted}>{stat.label}</p>
                      <p className="mt-3 text-3xl font-bold text-slate-900">
                        {stat.value}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {stat.detail}
                      </p>
                    </div>
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl font-bold ${stat.tone}`}
                    >
                      {stat.icon}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <section className={`${card} xl:col-span-2`}>
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Medication adherence
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Your recorded dose completion for today
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                    Daily overview
                  </span>
                </div>

                <div className="flex flex-col items-center gap-7 sm:flex-row sm:justify-around">
                  <ProgressRing
                    value={adherence}
                    label="Adherence"
                    color={adherenceColor}
                    size={174}
                  />

                  <div className="grid w-full grid-cols-2 gap-3 sm:max-w-sm">
                    <div className="rounded-xl bg-emerald-50 p-4">
                      <div className="flex items-center gap-2 text-sm text-emerald-800">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        Taken
                      </div>
                      <p className="mt-3 text-2xl font-bold text-emerald-800">
                        {takenToday}
                      </p>
                    </div>

                    <div className="rounded-xl bg-red-50 p-4">
                      <div className="flex items-center gap-2 text-sm text-red-800">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                        Missed
                      </div>
                      <p className="mt-3 text-2xl font-bold text-red-800">
                        {missedToday}
                      </p>
                    </div>

                    <div className="rounded-xl bg-blue-50 p-4">
                      <div className="flex items-center gap-2 text-sm text-blue-800">
                        <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                        Pending
                      </div>
                      <p className="mt-3 text-2xl font-bold text-blue-800">
                        {pendingToday}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-100 p-4">
                      <div className="text-sm text-slate-600">Recorded</div>
                      <p className="mt-3 text-2xl font-bold text-slate-800">
                        {recordedToday}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 border-t border-slate-100 pt-5">
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-slate-500">Recorded doses taken</span>
                    <span className="font-semibold text-slate-800">
                      {takenToday} / {recordedToday}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                      style={{ width: `${adherence}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Adherence is calculated from doses marked taken or missed.
                    Pending doses are not included in the percentage.
                  </p>
                </div>
              </section>

              <section className={card}>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">
                    Attention needed
                  </h3>
                  <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    {lowStock.length} alerts
                  </span>
                </div>

                {lowStock.length === 0 ? (
                  <div className="mt-5 rounded-xl bg-emerald-50 p-5 text-center">
                    <div className="text-3xl text-emerald-600">✓</div>
                    <p className="mt-2 font-semibold text-emerald-800">
                      All stocks look good
                    </p>
                    <p className="mt-1 text-sm text-emerald-700">
                      No low-stock medicines right now.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {lowStock.map((medicine) => (
                      <div
                        key={medicine.id}
                        className="rounded-xl border border-amber-200 bg-amber-50 p-3"
                      >
                        <p className="font-semibold text-slate-800">
                          {medicine.name}
                        </p>
                        <p className="mt-1 text-sm text-amber-800">
                          Only {medicine.stock} remaining
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setPage("alerts")}
                  className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  View all alerts →
                </button>
              </section>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <section className={card}>
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Your medicines
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Your scheduled medication list
                    </p>
                  </div>
                  <button
                    onClick={() => setPage("medicines")}
                    className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    Manage →
                  </button>
                </div>

                {medicines.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 p-6 text-center">
                    <p className="font-medium text-slate-700">
                      No medicines added yet
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Add your first medicine to begin tracking.
                    </p>
                    <button
                      onClick={() => setPage("medicines")}
                      className="mt-4 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      Add medicine
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {medicines.slice(0, 5).map((medicine) => (
                      <div
                        key={medicine.id}
                        className="rounded-xl border border-slate-100 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {medicine.name}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              {medicine.dosage}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              medicine.stock <= 5
                                ? "bg-amber-50 text-amber-700"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            Stock: {medicine.stock}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {getScheduledTimes(medicine).map((time) => (
                            <span
                              key={time}
                              className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-700"
                            >
                              ◷ {formatTime(time)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className={card}>
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Recent dose activity
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Your latest recorded doses
                    </p>
                  </div>
                  <button
                    onClick={() => setPage("history")}
                    className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    View all →
                  </button>
                </div>

                {recentHistory.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
                    Dose records will appear here when you record a dose.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {recentHistory.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"
                      >
                        <div>
                          <p className="font-semibold text-slate-800">
                            {item.medicine_name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDate(item.dose_date)} ·{" "}
                            {formatTime(item.scheduled_time)}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            item.status === "taken"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </section>
        )}

        {page === "medicines" && (
          <section className="grid items-start gap-6 xl:grid-cols-2">
            <form onSubmit={addMedicine} className={`${card} space-y-5`}>
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  Add a medicine
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Create your medicine record and daily reminders.
                </p>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Medicine name
                </span>
                <input
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="e.g. Paracetamol"
                  className={inputClass}
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Dosage
                </span>
                <input
                  value={newDosage}
                  onChange={(event) => setNewDosage(event.target.value)}
                  placeholder="e.g. 500 mg"
                  className={inputClass}
                  required
                />
              </label>

              <div>
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Reminder time
                </span>

                <div className="grid grid-cols-3 gap-3">
                  <label>
                    <span className="mb-1 block text-xs text-slate-500">
                      Hour
                    </span>
                    <select
                      value={newHour}
                      onChange={(event) => setNewHour(event.target.value)}
                      className={inputClass}
                    >
                      {Array.from({ length: 12 }, (_, index) =>
                        String(index + 1).padStart(2, "0"),
                      ).map((hour) => (
                        <option key={hour} value={hour}>
                          {hour}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span className="mb-1 block text-xs text-slate-500">
                      Minute
                    </span>
                    <select
                      value={newMinute}
                      onChange={(event) => setNewMinute(event.target.value)}
                      className={inputClass}
                    >
                      {Array.from({ length: 60 }, (_, index) =>
                        String(index).padStart(2, "0"),
                      ).map((minute) => (
                        <option key={minute} value={minute}>
                          {minute}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span className="mb-1 block text-xs text-slate-500">
                      AM / PM
                    </span>
                    <select
                      value={newPeriod}
                      onChange={(event) =>
                        setNewPeriod(event.target.value as "AM" | "PM")
                      }
                      className={inputClass}
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={addTime}
                  className="mt-3 rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                >
                  + Add reminder time
                </button>

                <div className="mt-3 flex flex-wrap gap-2">
                  {newTimes.map((time) => (
                    <span
                      key={time}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"
                    >
                      {formatTime(time)}
                      <button
                        type="button"
                        onClick={() => removeTime(time)}
                        aria-label={`Remove ${formatTime(time)}`}
                        className="font-bold hover:text-red-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                {newTimes.length === 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Select a time and press Add reminder time.
                  </p>
                )}
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Current stock
                </span>
                <input
                  type="number"
                  min="0"
                  value={newStock}
                  onChange={(event) => setNewStock(event.target.value)}
                  className={inputClass}
                  required
                />
              </label>

              <button
                type="submit"
                disabled={savingMedicine}
                className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {savingMedicine ? "Saving..." : "Save medicine"}
              </button>
            </form>

            <section className={card}>
              <div className="mb-5">
                <h3 className="text-xl font-bold text-slate-900">
                  Your medicines
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Track stock and record each scheduled dose.
                </p>
              </div>

              {medicines.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
                  Your medicine list is empty.
                </p>
              ) : (
                <div className="space-y-4">
                  {medicines.map((medicine) => (
                    <div
                      key={medicine.id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-bold text-slate-900">
                            {medicine.name}
                          </h4>
                          <p className="mt-1 text-sm text-slate-500">
                            {medicine.dosage}
                          </p>
                          <p className="mt-2 text-sm text-slate-600">
                            Stock:{" "}
                            <span
                              className={
                                medicine.stock <= 5
                                  ? "font-semibold text-amber-700"
                                  : "font-medium"
                              }
                            >
                              {medicine.stock}
                            </span>
                          </p>
                        </div>

                        <button
                          onClick={() => deleteMedicine(medicine.id)}
                          disabled={busyMedicineId === medicine.id}
                          className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {getScheduledTimes(medicine).map((time) => (
                          <span
                            key={time}
                            className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-700"
                          >
                            {formatTime(time)}
                          </span>
                        ))}
                      </div>

                      <div className="mt-4 border-t border-slate-100 pt-4">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Today&apos;s dose records
                        </p>

                        <div className="space-y-3">
                          {getScheduledTimes(medicine).map((time) => {
                            const recorded = history.some(
                              (item) =>
                                item.medicine_id === medicine.id &&
                                item.dose_date === today &&
                                item.scheduled_time === time,
                            );

                            const record = history.find(
                              (item) =>
                                item.medicine_id === medicine.id &&
                                item.dose_date === today &&
                                item.scheduled_time === time,
                            );

                            return (
                              <div
                                key={time}
                                className="flex flex-wrap items-center justify-between gap-2"
                              >
                                <div>
                                  <p className="text-sm font-medium text-slate-700">
                                    {formatTime(time)}
                                  </p>
                                  {record && (
                                    <p className="mt-1 text-xs text-slate-500">
                                      {record.status}
                                    </p>
                                  )}
                                </div>

                                {recorded ? (
                                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
                                    Recorded
                                  </span>
                                ) : (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() =>
                                        recordDose(medicine, time, "taken")
                                      }
                                      disabled={
                                        busyMedicineId === medicine.id
                                      }
                                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                      Taken
                                    </button>
                                    <button
                                      onClick={() =>
                                        recordDose(medicine, time, "missed")
                                      }
                                      disabled={
                                        busyMedicineId === medicine.id
                                      }
                                      className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                                    >
                                      Missed
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </section>
        )}

        {page === "analytics" && (
          <section className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className={card}>
                <p className={muted}>Doses taken today</p>
                <p className="mt-3 text-3xl font-bold text-emerald-600">
                  {takenToday}
                </p>
              </div>
              <div className={card}>
                <p className={muted}>Doses missed today</p>
                <p className="mt-3 text-3xl font-bold text-red-600">
                  {missedToday}
                </p>
              </div>
              <div className={card}>
                <p className={muted}>Pending doses</p>
                <p className="mt-3 text-3xl font-bold text-blue-600">
                  {pendingToday}
                </p>
              </div>
              <div className={card}>
                <p className={muted}>Adherence today</p>
                <p className="mt-3 text-3xl font-bold text-slate-900">
                  {adherence}%
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className={card}>
                <h3 className="text-lg font-bold text-slate-900">
                  Daily adherence
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Percentage of recorded doses taken successfully.
                </p>

                <div className="flex flex-col items-center gap-5 py-6">
                  <ProgressRing
                    value={adherence}
                    label="Adherence"
                    color={adherenceColor}
                    size={190}
                  />
                  <p className="max-w-sm text-center text-sm text-slate-500">
                    {recordedToday === 0
                      ? "Record a dose to begin measuring your adherence."
                      : adherence >= 80
                        ? "Great progress. Keep following your prescribed schedule."
                        : "Review your dose records and follow your prescribed schedule."}
                  </p>
                </div>

                <div className="space-y-4">
                  {[
                    {
                      label: "Taken",
                      value: takenToday,
                      color: "bg-emerald-500",
                    },
                    {
                      label: "Missed",
                      value: missedToday,
                      color: "bg-red-500",
                    },
                    {
                      label: "Pending",
                      value: pendingToday,
                      color: "bg-blue-500",
                    },
                  ].map((item) => {
                    const denominator = Math.max(totalScheduledToday, 1);
                    const percentage = Math.min(
                      100,
                      Math.round((item.value / denominator) * 100),
                    );

                    return (
                      <div key={item.label}>
                        <div className="mb-2 flex justify-between text-sm">
                          <span className="text-slate-600">{item.label}</span>
                          <span className="font-semibold text-slate-800">
                            {item.value} ({percentage}%)
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${item.color}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className={card}>
                <h3 className="text-lg font-bold text-slate-900">
                  Dose distribution
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Breakdown of doses recorded today.
                </p>

                <div className="mt-6 space-y-5">
                  {[
                    {
                      label: "Taken",
                      value: takenToday,
                      color: "#10b981",
                    },
                    {
                      label: "Missed",
                      value: missedToday,
                      color: "#ef4444",
                    },
                  ].map((item) => {
                    const total = Math.max(recordedToday, 1);
                    const percentage = Math.round(
                      (item.value / total) * 100,
                    );

                    return (
                      <div
                        key={item.label}
                        className="rounded-xl border border-slate-100 p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="font-medium text-slate-700">
                              {item.label}
                            </span>
                          </div>
                          <span className="text-xl font-bold text-slate-900">
                            {item.value}
                          </span>
                        </div>
                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: item.color,
                            }}
                          />
                        </div>
                        <p className="mt-2 text-right text-xs text-slate-500">
                          {percentage}% of recorded doses
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 rounded-xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-800">
                    Total scheduled doses
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {totalScheduledToday}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Across all medicines currently listed.
                  </p>
                </div>
              </section>
            </div>

            <section className={card}>
              <div className="mb-5">
                <h3 className="text-lg font-bold text-slate-900">
                  Recent dose activity
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Recent records from your medicine history.
                </p>
              </div>

              {history.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
                  No dose records yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {history.slice(0, 20).map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-4"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">
                          {item.medicine_name}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatDate(item.dose_date)} ·{" "}
                          {formatTime(item.scheduled_time)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                          item.status === "taken"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </section>
        )}

        {page === "alerts" && (
          <section className="space-y-5">
            <div className={card}>
              <h3 className="text-lg font-bold text-slate-900">
                Reminder notifications
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Enable browser notifications to receive reminders while this
                website is open.
              </p>
              <button
                onClick={enableNotifications}
                className="mt-4 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700"
              >
                {notificationsEnabled
                  ? "Notifications enabled"
                  : "Enable notifications"}
              </button>
            </div>

            <div className={card}>
              <h3 className="text-lg font-bold text-slate-900">
                Low-stock alerts
              </h3>

              {lowStock.length === 0 ? (
                <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
                  No low-stock medicines. Your current stock levels look good.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {lowStock.map((medicine) => (
                    <div
                      key={medicine.id}
                      className="rounded-xl border border-amber-200 bg-amber-50 p-4"
                    >
                      <p className="font-semibold text-slate-800">
                        {medicine.name}
                      </p>
                      <p className="mt-1 text-sm text-amber-800">
                        Remaining stock: {medicine.stock}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {page === "history" && (
          <section className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Medicine history
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Review previously recorded doses.
                </p>
              </div>

              <select
                value={historyFilter}
                onChange={(event) => setHistoryFilter(event.target.value)}
                className={`${inputClass} max-w-40`}
              >
                <option value="all">All records</option>
                <option value="taken">Taken</option>
                <option value="missed">Missed</option>
              </select>
            </div>

            {history.filter(
              (item) =>
                historyFilter === "all" || item.status === historyFilter,
            ).length === 0 ? (
              <p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
                No history records found.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {history
                  .filter(
                    (item) =>
                      historyFilter === "all" ||
                      item.status === historyFilter,
                  )
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-4"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">
                          {item.medicine_name}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatDate(item.dose_date)} ·{" "}
                          {formatTime(item.scheduled_time)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                          item.status === "taken"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </section>
        )}

        {page === "assistant" && (
          <section className={`${card} mx-auto max-w-3xl`}>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-2xl text-violet-700">
                ✧
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  MediCare AI Assistant
                </h3>
                <p className="text-sm text-slate-500">
                  Ask about your medicine schedule and stock.
                </p>
              </div>
            </div>

            <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              AI responses are informational only. Confirm medical decisions
              and dosage changes with a qualified healthcare professional.
            </p>

            <div className="my-5 max-h-[55vh] space-y-4 overflow-y-auto rounded-xl bg-slate-50 p-4">
              {chat.length === 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                  Try asking: &quot;Show my medicine schedule&quot; or
                  &quot;Which medicines have low stock?&quot;
                </div>
              )}

              {chat.map((message, index) => (
                <div
                  key={`${index}-${message.role}`}
                  className={`max-w-[90%] whitespace-pre-wrap rounded-2xl p-4 text-sm ${
                    message.role === "user"
                      ? "ml-auto bg-emerald-600 text-white"
                      : "border border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {message.content}
                </div>
              ))}

              {aiLoading && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                  Thinking...
                </div>
              )}
            </div>

            <form onSubmit={askAssistant} className="flex gap-2">
              <input
                value={aiQuestion}
                onChange={(event) => setAiQuestion(event.target.value)}
                placeholder="Ask your question..."
                className={`min-w-0 flex-1 ${inputClass}`}
              />
              <button
                type="submit"
                disabled={aiLoading || !aiQuestion.trim()}
                className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </section>
        )}

        {page === "settings" && (
          <section className="max-w-2xl space-y-5">
            <div className={card}>
              <h3 className="text-lg font-bold text-slate-900">Profile</h3>

              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-slate-500">Name</p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {userName}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-slate-500">User ID</p>
                  <p className="mt-1 break-all font-mono text-xs text-slate-700">
                    {userId}
                  </p>
                </div>
              </div>
            </div>

            <div className={card}>
              <h3 className="text-lg font-bold text-slate-900">
                Reminder preferences
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Medicine times are displayed in 12-hour format with AM/PM.
                Reminder times are stored internally in 24-hour format so the
                existing reminder checks continue to work.
              </p>

              <button
                onClick={enableNotifications}
                className="mt-4 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {notificationsEnabled
                  ? "Browser notifications enabled"
                  : "Enable browser notifications"}
              </button>
            </div>

            <button
              onClick={logout}
              disabled={loggingOut}
              className="rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              {loggingOut ? "Signing out..." : "Sign out"}
            </button>
          </section>
        )}
      </main>
    </div>
  );
}