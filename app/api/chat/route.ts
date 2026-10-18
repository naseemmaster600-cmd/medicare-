import { NextResponse } from "next/server";

type ChatMessage = {
  role?: string;
  content?: string;
};

type Dose = {
  scheduledTime?: string;
  displayTime?: string;
  status?: string;
};

type Medicine = {
  id?: string | number;
  name?: string;
  dosage?: string;
  time?: string;
  scheduledTime?: string;
  scheduledTimes?: string[];
  times?: string[];
  doses?: Dose[];
  stock?: number | string;
  status?: string;
  [key: string]: unknown;
};

type MedicineHistory = {
  id?: string | number;
  medicine_id?: string | number;
  medicineId?: string | number;
  medicine?: string;
  medicine_name?: string;
  scheduledTime?: string;
  scheduled_time?: string;
  status?: string;
  date?: string;
  dose_date?: string;
  recorded_at?: string;
  [key: string]: unknown;
};

type DoseStatus =
  | "taken"
  | "recorded_missed"
  | "past_unrecorded"
  | "due_now"
  | "upcoming";

function getIndiaDateTime() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    currentDate: `${get("year")}-${get("month")}-${get("day")}`,
    currentTime: `${get("hour")}:${get("minute")}`,
    timeZone: "Asia/Kolkata (IST, UTC+05:30)",
  };
}

function normalizeTime(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const input = value.trim();

  const twentyFourHour = input.match(
    /^(\d{1,2}):(\d{2})(?::\d{2})?$/
  );

  if (twentyFourHour) {
    const hour = Number(twentyFourHour[1]);
    const minute = Number(twentyFourHour[2]);

    if (hour > 23 || minute > 59) return null;

    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  const twelveHour = input.match(
    /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
  );

  if (twelveHour) {
    let hour = Number(twelveHour[1]);
    const minute = Number(twelveHour[2]);

    if (hour < 1 || hour > 12 || minute > 59) return null;

    const period = twelveHour[3].toUpperCase();
    hour = hour % 12;

    if (period === "PM") hour += 12;

    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  return null;
}

function getScheduledTimes(medicine: Medicine): string[] {
  const candidates: unknown[] = [];

  if (Array.isArray(medicine.times)) {
    candidates.push(...medicine.times);
  }

  if (Array.isArray(medicine.scheduledTimes)) {
    candidates.push(...medicine.scheduledTimes);
  }

  if (Array.isArray(medicine.doses)) {
    candidates.push(
      ...medicine.doses.map((dose) => dose.scheduledTime ?? dose.displayTime)
    );
  }

  candidates.push(medicine.scheduledTime, medicine.time);

  const times = candidates
    .map(normalizeTime)
    .filter((time): time is string => time !== null);

  return [...new Set(times)].sort();
}

function getHistoryDate(item: MedicineHistory): string {
  const explicitDate = item.dose_date ?? item.date;

  if (
    typeof explicitDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(explicitDate)
  ) {
    return explicitDate;
  }

  if (typeof item.recorded_at === "string") {
    const parsed = new Date(item.recorded_at);

    if (!Number.isNaN(parsed.getTime())) {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(parsed);

      const get = (type: string) =>
        parts.find((part) => part.type === type)?.value ?? "";

      return `${get("year")}-${get("month")}-${get("day")}`;
    }
  }

  return "";
}

function sameMedicine(
  medicine: Medicine,
  history: MedicineHistory
): boolean {
  const medicineId = medicine.id;
  const historyId = history.medicine_id ?? history.medicineId;

  if (medicineId != null && historyId != null) {
    return String(medicineId) === String(historyId);
  }

  const medicineName = medicine.name?.trim().toLowerCase();
  const historyName = String(
    history.medicine_name ?? history.medicine ?? ""
  )
    .trim()
    .toLowerCase();

  return Boolean(
    medicineName && historyName && medicineName === historyName
  );
}

function getDoseStatus(
  medicine: Medicine,
  scheduledTime: string,
  history: MedicineHistory[],
  currentDate: string,
  currentTime: string
): DoseStatus {
  const matchingRecords = history.filter((item) => {
    const recordTime = normalizeTime(
      item.scheduled_time ?? item.scheduledTime
    );

    return (
      sameMedicine(medicine, item) &&
      recordTime === scheduledTime &&
      getHistoryDate(item) === currentDate
    );
  });

  const hasTaken = matchingRecords.some(
    (item) => String(item.status).toLowerCase() === "taken"
  );

  const hasMissed = matchingRecords.some(
    (item) => String(item.status).toLowerCase() === "missed"
  );

  if (hasTaken && hasMissed) return "past_unrecorded";
  if (hasTaken) return "taken";
  if (hasMissed) return "recorded_missed";

  if (scheduledTime < currentTime) return "past_unrecorded";
  if (scheduledTime === currentTime) return "due_now";

  return "upcoming";
}

function formatDisplayTime(time: string): string {
  const [hourText, minute] = time.split(":");
  const hour = Number(hourText);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minute} ${suffix}`;
}

function analyzeDoses(
  medicines: Medicine[],
  history: MedicineHistory[],
  currentDate: string,
  currentTime: string
) {
  return medicines.map((medicine) => ({
    medicine: medicine.name ?? "Unnamed medicine",
    dosage: medicine.dosage ?? "Not specified",
    stock: medicine.stock ?? "Not specified",
    doses: getScheduledTimes(medicine).map((time) => ({
      scheduledTime: time,
      displayTime: formatDisplayTime(time),
      status: getDoseStatus(
        medicine,
        time,
        history,
        currentDate,
        currentTime
      ),
    })),
  }));
}

function buildDoseAnswer(
  analysis: ReturnType<typeof analyzeDoses>,
  currentTime: string,
  tanglish: boolean
): string {
  const labels: Record<DoseStatus, string> = {
    taken: "Taken (history confirmed)",
    recorded_missed: "Recorded as missed",
    past_unrecorded: "Past, but not recorded",
    due_now: "Due now",
    upcoming: "Upcoming",
  };

  const lines: string[] = [];

  for (const medicine of analysis) {
    if (medicine.doses.length === 0) {
      lines.push(
        `• ${medicine.medicine}: Schedule time data is missing. Please check the saved medicine schedule.`
      );
      continue;
    }

    lines.push(`• ${medicine.medicine} (${medicine.dosage})`);

    for (const dose of medicine.doses) {
      lines.push(
        `  - ${dose.displayTime}: ${labels[dose.status as DoseStatus]}`
      );
    }
  }

  const hasRecordedMissed = analysis.some((medicine) =>
    medicine.doses.some((dose) => dose.status === "recorded_missed")
  );

  const hasUnrecorded = analysis.some((medicine) =>
    medicine.doses.some((dose) => dose.status === "past_unrecorded")
  );

  const intro = tanglish
    ? `IST time ${formatDisplayTime(currentTime)} padi, ovvoru dose-oda status:`
    : `Based on the current IST time (${formatDisplayTime(currentTime)}), each dose is:`;

  const note = tanglish
    ? hasRecordedMissed
      ? "History-la 'missed' nu save aana dose mattum recorded missed. Future dose upcoming-thaan."
      : hasUnrecorded
        ? "Past time aana dose-ku history record illa. Adhu miss aayiduchu-nu confirm panna mudiyadhu. Future doses upcoming-thaan."
        : "Future scheduled doses upcoming-nu kaattappadum. Prescription instructions-ai follow pannunga."
    : hasRecordedMissed
      ? "Only doses explicitly recorded as missed are confirmed missed. Future doses remain upcoming."
      : hasUnrecorded
        ? "A past scheduled time without a matching record does not confirm a missed dose. Future doses remain upcoming."
        : "Future scheduled doses remain upcoming. Follow your prescribed instructions.";

  return `${intro}\n\n${lines.join("\n")}\n\n${note}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const question =
      typeof body.question === "string" ? body.question.trim() : "";

    const messages: ChatMessage[] = Array.isArray(body.messages)
      ? body.messages
      : [];

    const medicines: Medicine[] = Array.isArray(body.medicines)
      ? body.medicines
      : [];

    const medicineHistory: MedicineHistory[] = Array.isArray(body.history)
      ? body.history.slice(-500)
      : [];

    const indiaDateTime = getIndiaDateTime();

    if (!question) {
      return NextResponse.json(
        { error: "Please enter a question." },
        { status: 400 }
      );
    }

    if (medicines.length === 0) {
      return NextResponse.json({
        answer:
          "No medicines are saved yet. Add your medicines in the Medicines section first.",
        ...indiaDateTime,
      });
    }

    const doseAnalysis = analyzeDoses(
      medicines,
      medicineHistory,
      indiaDateTime.currentDate,
      indiaDateTime.currentTime
    );

    const doseQuestionPattern =
      /\b(miss(?:ed|ing)?|overdue|taken|dose|dosage|schedule|medicine history|today'?s?|status|time|when|stock|medicine|medicines)\b|edukkala|eduthacha|eduthenaa|marandh|miss aachu|miss pann|inniku|indru|eppo|ethana|enna/i;

    if (doseQuestionPattern.test(question)) {
      const tanglish =
        /\b(enna|edutha|eduthacha|edukkala|aachu|irukka|irukku|pann|marandh|naan|inniku|indru|sollu|entha|eppo|ethana)\b/i.test(
          question
        );

      return NextResponse.json({
        answer: buildDoseAnswer(
          doseAnalysis,
          indiaDateTime.currentTime,
          tanglish
        ),
        ...indiaDateTime,
      });
    }

    const medicineContext = JSON.stringify(
      {
        ...indiaDateTime,
        savedMedicines: medicines,
        recentMedicineHistory: medicineHistory,
        calculatedDoseStatus: doseAnalysis,
      },
      null,
      2
    );

    const conversation = messages
      .filter(
        (message) =>
          ["user", "assistant"].includes(message.role ?? "") &&
          typeof message.content === "string"
      )
      .slice(-10)
      .map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.content as string,
      }))
      .filter((message) => message.content.trim().length > 0);

    const response = await fetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2",
        stream: false,
        messages: [
          {
            role: "system",
            content: `You are MediCare+ AI Assistant.

Answer questions about the user's saved medicines, schedules, reminders, and stock.
Use calculatedDoseStatus as the authoritative dose status.
Never invent schedule times or claim an unrecorded dose was missed.
Use the supplied Asia/Kolkata time, not an assumed local time.
A future scheduled dose is Upcoming, never Missed.
Do not diagnose illnesses, prescribe medicines, or advise changing doses.
Tell users to follow their prescribed instructions.
Reply in the same language as the user and keep answers concise.

WEBSITE DATA:
${medicineContext}`,
          },
          ...conversation,
          { role: "user", content: question },
        ],
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            "AI service is unavailable. Check that Ollama is running and llama3.2 is installed.",
        },
        { status: 503 }
      );
    }

    const data = await response.json();
    const answer = data.message?.content;

    if (typeof answer !== "string" || !answer.trim()) {
      return NextResponse.json(
        { error: "The AI returned an empty answer. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      answer: answer.trim(),
      ...indiaDateTime,
    });
  } catch (error) {
    console.error("MediCare+ chat error:", error);

    return NextResponse.json(
      {
        error:
          "Cannot connect to the AI service. Check that Ollama is running and try again.",
      },
      { status: 503 }
    );
  }
}