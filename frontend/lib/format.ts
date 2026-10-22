// Sana, vaqt va raqamlarni ko'rsatish uchun umumiy yordamchilar (Toshkent vaqti).

const TZ = "Asia/Tashkent";

export const MONTHS_SHORT = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
export const MONTHS_LONG = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
export const WEEKDAYS_SHORT = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];
export const WEEKDAYS_LONG = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];

type Parts = { y: number; m: number; d: number; h: number; min: number; wd: number };

/** Berilgan vaqtni Toshkent vaqti bo'yicha bo'laklarga ajratadi. */
export function tz(date: string | number | Date): Parts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date(date)).map((x) => [x.type, x.value]));
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, wd };
}

export const dayKey = (date: string | number | Date) => {
  const p = tz(date);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
};

export const fmtTime = (date: string | number | Date) => {
  const p = tz(date);
  return `${String(p.h).padStart(2, "0")}:${String(p.min).padStart(2, "0")}`;
};

export const fmtDay = (date: string | number | Date) => {
  const p = tz(date);
  return `${p.d} ${MONTHS_SHORT[p.m - 1]}`;
};

export const fmtDayLong = (date: string | number | Date) => {
  const p = tz(date);
  return `${p.d} ${MONTHS_LONG[p.m - 1].toLowerCase()}`;
};

export const fmtDateTime = (date: string | number | Date) => `${fmtDay(date)}, ${fmtTime(date)}`;

export const fmtFull = (date: string | number | Date) => {
  const p = tz(date);
  return `${WEEKDAYS_LONG[p.wd]}, ${p.d} ${MONTHS_LONG[p.m - 1].toLowerCase()}`;
};

export const isToday = (date: string | number | Date) => dayKey(date) === dayKey(Date.now());

/** Dushanba kuni 00:00 (Toshkent) ga to'g'ri keladigan haftaning boshlanishi. */
export function weekStart(offsetWeeks = 0, from: number = Date.now()) {
  const p = tz(from);
  const back = (p.wd + 6) % 7;
  const base = Date.UTC(p.y, p.m - 1, p.d) - back * 86_400_000 + offsetWeeks * 7 * 86_400_000;
  return base; // UTC yarim tunga mos, faqat dayKey uchun ishlatiladi
}

export const dayKeyFromUtcMidnight = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};

/** Qolgan vaqtni qisqa matn ko'rinishida beradi: "2 kun 4 soat", "35 daqiqa", "o'tib ketdi". */
export function timeLeft(date: string | number | Date) {
  const diff = new Date(date).getTime() - Date.now();
  const past = diff < 0;
  const abs = Math.abs(diff);
  const mins = Math.floor(abs / 60_000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  let text: string;
  if (days >= 1) text = hours ? `${days} kun ${hours} soat` : `${days} kun`;
  else if (mins >= 60) text = `${Math.floor(mins / 60)} soat ${mins % 60 ? `${mins % 60} daq` : ""}`.trim();
  else text = `${Math.max(mins, 1)} daqiqa`;
  return { past, text, urgent: !past && diff < 86_400_000, soon: !past && diff < 3 * 86_400_000 };
}

export const money = (value: number) =>
  `${Math.round(value).toLocaleString("ru-RU").replace(/ /g, " ")} so‘m`;

export const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join("") || "?";

export const greeting = () => {
  const h = tz(Date.now()).h;
  if (h < 5) return "Xayrli tun";
  if (h < 12) return "Xayrli tong";
  if (h < 18) return "Xayrli kun";
  return "Xayrli kech";
};

/** Kurslar uchun doimiy rang palitrasi. */
export const COURSE_COLORS = [
  { dot: "#6366f1", soft: "#eef0ff", text: "#3f43c4" },
  { dot: "#0ea5e9", soft: "#e6f5fd", text: "#0b6d99" },
  { dot: "#10b981", soft: "#e4f7ef", text: "#0a7656" },
  { dot: "#f59e0b", soft: "#fff3dc", text: "#a2640a" },
  { dot: "#ec4899", soft: "#fdeaf3", text: "#a8266b" },
  { dot: "#8b5cf6", soft: "#f0eaff", text: "#5b34b8" },
  { dot: "#14b8a6", soft: "#e2f7f4", text: "#0b7a6f" },
  { dot: "#ef4444", soft: "#fdeceb", text: "#b02a2a" },
];
export const courseColor = (id: number | string | null | undefined) =>
  COURSE_COLORS[(Number(id) || 0) % COURSE_COLORS.length];

export const gradeTone = (grade: number | null | undefined) => {
  if (grade === null || grade === undefined) return "neutral" as const;
  if (grade >= 86) return "green" as const;
  if (grade >= 70) return "blue" as const;
  if (grade >= 55) return "amber" as const;
  return "red" as const;
};
