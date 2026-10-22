// Backend-siz demo rejim: NEXT_PUBLIC_DEMO_MODE=1 bo'lganda api-service so'rovlari
// shu fayldagi xotiradagi ma'lumotlarga yo'naltiriladi. Hech qanday haqiqiy server,
// baza yoki parol ishlatilmaydi. Sahifani yangilasangiz o'zgarishlar tiklanadi.

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

export class DemoError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

type Row = Record<string, any>;

const DAY = 86_400_000;
const MIN = 60_000;
const iso = (t: number) => new Date(t).toISOString();

const now = Date.now();
const weekStart = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
})();

// ---------- Foydalanuvchilar ----------
const studentNames: [string, string][] = [
  ["talaba_demo", "Demo Talaba"],
  ["azizbek.a", "Aliyev Azizbek"],
  ["nilufar.k", "Karimova Nilufar"],
  ["akmal.r", "Rasulov Akmal"],
  ["madina.s", "Sodiqova Madina"],
  ["oybek.t", "Tursunov Oybek"],
  ["mohira.y", "Yusupova Mohira"],
  ["asadbek.b", "Bozorov Asadbek"],
  ["sevinch.d", "Daminova Sevinch"],
  ["mirjalol.e", "Eshmurodov Mirjalol"],
  ["aziza.s", "Salimova Aziza"],
  ["jamshid.n", "Norqulov Jamshid"],
  ["sardor.m", "Mamatqulov Sardor"],
  ["zarnigor.h", "Hasanova Zarnigor"],
  ["bekzod.q", "Qodirov Bekzod"],
  ["shahnoza.i", "Ismoilova Shahnoza"],
  ["umidjon.s", "Sobirov Umidjon"],
  ["malika.r", "Rahimova Malika"],
  ["diyorbek.o", "Ortiqov Diyorbek"],
  ["munisa.a", "Abdurahmonova Munisa"],
];

const users: Row[] = [
  mkUser(1, "admin_demo", "Demo Administrator", "admin"),
  mkUser(2, "ustoz_demo", "Demo Ustoz", "ustoz"),
  ...studentNames.map(([u, n], i) => mkUser(3 + i, u, n, "student", i + 1)),
];

function mkUser(id: number, username: string, fullname: string, role: string, n = 0): Row {
  return {
    id,
    username,
    fullname,
    role,
    email: `${username}@demo.local`,
    bio: role === "ustoz" ? "Dasturlash fanlari o‘qituvchisi." : "",
    student_id: role === "student" ? `IT10226-${String(n).padStart(3, "0")}` : null,
    group_code: role === "student" ? "IT102-26" : "",
    phone_number: role === "student" ? `+998 90 700 ${String(n).padStart(2, "0")} ${String(n).padStart(2, "0")}` : "",
    telegram_chat_id: null,
    telegram_connected: false,
    is_active: true,
    must_change_password: false,
  };
}
const omit = (row: Row, keys: string[]): Row =>
  Object.fromEntries(Object.entries(row).filter(([k]) => !keys.includes(k)));
const students = () => users.filter((u) => u.role === "student");
const userById = (id: number) => users.find((u) => u.id === id)!;

// ---------- Kurslar ----------
const courseSpecs: [string, string, string][] = [
  ["WD101", "Web dasturlash", "Frontend va backend web dasturlash"],
  ["DB201", "Ma’lumotlar bazasi", "SQL va ma’lumotlar bazasi asoslari"],
  ["PY101", "Python asoslari", "Python dasturlash asoslari"],
  ["NET201", "Tarmoq texnologiyalari", "Kompyuter tarmoqlari"],
  ["MOB201", "Mobil ilovalar", "Mobil dasturlash"],
  ["WEB201", "Web texnologiyalari", "Zamonaviy web texnologiyalar"],
  ["AI301", "Sun’iy intellekt", "AI va mashinaviy o‘rganish asoslari"],
  ["SYS201", "Tizimlar tahlili", "Axborot tizimlarini tahlil qilish"],
];
const courses: Row[] = courseSpecs.map(([code, title, description], i) => ({
  id: i + 1,
  code,
  title,
  description,
  teacher: 2,
  is_archived: false,
  created_at: iso(weekStart - 60 * DAY),
  studentIds: students().map((s) => s.id),
}));
const courseById = (id: number) => courses.find((c) => c.id === id);
const courseTitle = (id: number | null) => (id ? courseById(id)?.title : null) ?? "Eski material";
const courseOut = (c: Row) => ({
  id: c.id,
  title: c.title,
  code: c.code,
  description: c.description,
  teacher: c.teacher,
  teacher_name: userById(c.teacher).fullname,
  student_count: c.studentIds.length,
  is_archived: c.is_archived,
  created_at: c.created_at,
});

// ---------- Materiallar ----------
const bookSpecs: [number, string, string][] = [
  [1, "HTML va CSS qo‘llanmasi", "Frontend"],
  [1, "JavaScript asoslari (slaydlar)", "Frontend"],
  [2, "SQL so‘rovlari bo‘yicha amaliy mashqlar", "SQL"],
  [2, "Normallashtirish nazariyasi", "Nazariya"],
  [3, "Python: boshlang‘ich qo‘llanma", "Python"],
  [3, "Funksiyalar va modullar", "Python"],
  [4, "OSI modeli va TCP/IP", "Tarmoq"],
  [5, "Android ilovalar dizayni", "Mobil"],
  [7, "Mashinaviy o‘rganishga kirish", "AI"],
  [8, "UML diagrammalar bo‘yicha misollar", "Tahlil"],
];
const books: Row[] = bookSpecs.map(([course, title, subject], i) => ({
  id: i + 1,
  course,
  title,
  subject,
  file: `/media/books/demo-material-${i + 1}.pdf`,
  uploaded_by: 2,
  uploaded_at: iso(weekStart - (i + 2) * DAY),
}));
const bookOut = (b: Row) => ({ ...b, course_title: courseTitle(b.course) });

// ---------- Topshiriqlar ----------
const assignmentSpecs: [number, string, string, number, number, boolean][] = [
  [1, "Shaxsiy portfolio sahifasi", "HTML/CSS yordamida shaxsiy portfolio sahifasini yarating va ZIP qilib yuklang.", 6, 3, false],
  [1, "JavaScript: to-do ilovasi", "Vanilla JS bilan vazifalar ro‘yxati ilovasini yozing.", -2, 3, false],
  [2, "SQL: 10 ta so‘rov", "Berilgan jadvallar bo‘yicha 10 ta SELECT so‘rovini yozing.", 4, 2, false],
  [3, "Python: kalkulyator", "Funksiyalar yordamida konsol kalkulyator yarating.", -6, 3, true],
  [4, "Tarmoq topologiyasi chizmasi", "Kichik ofis uchun tarmoq topologiyasini chizing.", 9, 2, false],
  [7, "ML: ma’lumotlar tahlili", "Berilgan dataset bo‘yicha qisqa tahliliy hisobot tayyorlang.", 12, 3, false],
];
const assignments: Row[] = assignmentSpecs.map(([course, title, description, dueDays, maxAttempts, late], i) => ({
  id: i + 1,
  course,
  title,
  description,
  file: null,
  deadline: iso(now + dueDays * DAY),
  teacher: 2,
  max_attempts: maxAttempts,
  allow_late: late,
  created_at: iso(now - (10 - i) * DAY),
  updated_at: iso(now - (10 - i) * DAY),
}));
const feedbacks = ["Yaxshi ish, tuzilma aniq.", "Kod tozaroq bo‘lishi mumkin, lekin natija to‘g‘ri.", "A’lo darajada bajarilgan!", "Bir necha xatolik bor, izohlarga qarang."];
const submissions: Row[] = [];
let submissionId = 1;
// Topshirilgan javoblar: 2 va 4-topshiriqlar muddati o‘tgan; ko‘pchilik talabalar yuborgan.
students().forEach((s, idx) => {
  [2, 4, 1, 3].forEach((aid, k) => {
    if ((idx + k) % 5 === 4) return; // ba'zilari yubormagan
    if (aid === 1 && idx % 2 === 1) return;
    if (aid === 3 && idx % 3 !== 0) return;
    const a = assignments[aid - 1];
    const graded = aid === 2 || aid === 4 ? idx % 7 !== 6 : idx % 4 === 0;
    submissions.push({
      id: submissionId++,
      assignment: aid,
      student: s.id,
      file: `/media/submissions/demo-${s.username}-${aid}.zip`,
      submitted_at: iso(Math.min(now - DAY, new Date(a.deadline).getTime() - DAY)),
      grade: graded ? 70 + ((idx * 7 + aid * 5) % 31) : null,
      graded_at: graded ? iso(now - DAY / 2) : null,
      feedback: graded ? feedbacks[(idx + aid) % feedbacks.length] : "",
      attempt: 1,
    });
  });
});
const asgOut = (a: Row, viewer: Row) => {
  const mine = submissions.filter((s) => s.assignment === a.id && s.student === viewer.id);
  return {
    ...a,
    course_title: courseTitle(a.course),
    is_submitted: viewer.role === "student" && mine.length > 0,
    attempts_used: viewer.role === "student" ? mine.length : 0,
    submission_count: submissions.filter((s) => s.assignment === a.id).length,
    is_overdue: new Date(a.deadline).getTime() < Date.now(),
    course_archived: !!courseById(a.course)?.is_archived,
  };
};
const subOut = (s: Row) => {
  const a = assignments.find((x) => x.id === s.assignment)!;
  const st = userById(s.student);
  return {
    id: s.id,
    assignment: { id: a.id, course: a.course, course_title: courseTitle(a.course), title: a.title, deadline: a.deadline },
    student: s.student,
    student_name: st.fullname,
    student_username: st.username,
    file: s.file,
    submitted_at: s.submitted_at,
    grade: s.grade === null ? null : String(s.grade),
    graded_at: s.graded_at,
    feedback: s.feedback,
    attempt: s.attempt,
    is_late: new Date(s.submitted_at) > new Date(a.deadline),
  };
};

// ---------- Taqvim ----------
const periodStarts: Record<number, [number, number]> = { 1: [8, 0], 2: [9, 20], 3: [10, 40], 4: [12, 0], 5: [13, 20], 6: [14, 40] };
const schedule: [number, number, number, string][] = [
  [0, 1, 1, "A-301"], [0, 3, 2, "B-204"], [1, 2, 3, "A-302"], [1, 4, 4, "B-205"], [1, 5, 1, "A-301"],
  [3, 1, 5, "B-201"], [3, 3, 6, "A-301"], [3, 4, 7, "A-401"], [3, 6, 3, "A-302"],
  [4, 2, 2, "B-204"], [4, 4, 1, "A-301"], [4, 5, 8, "B-203"], [5, 1, 3, "A-302"], [5, 6, 2, "B-204"],
];
const events: Row[] = [];
let eventId = 1;
[-1, 0, 1].flatMap((w) => schedule.map((x) => [...x, w] as [number, number, number, string, number])).forEach(([day, period, course, room, w]) => {
  const [h, m] = periodStarts[period];
  const start = new Date(weekStart + (day + w * 7) * DAY);
  start.setHours(h, m, 0, 0);
  events.push({
    id: eventId++,
    course,
    title: courseById(course)!.title,
    description: "IT102-26 kunduzgi guruh darsi",
    event_type: "lesson",
    start_time: iso(start.getTime()),
    end_time: iso(start.getTime() + 70 * MIN),
    room,
    period,
    for_group: "IT102-26",
    created_by: 2,
    created_at: iso(weekStart - DAY),
  });
});
events.push({
  id: eventId++, course: 2, title: "Ma’lumotlar bazasi — oraliq nazorat", description: "SQL va normallashtirish bo‘yicha yozma ish.",
  event_type: "exam", start_time: iso(weekStart + 9 * DAY + 10 * 3600_000), end_time: iso(weekStart + 9 * DAY + 11.5 * 3600_000),
  room: "B-204", period: null, for_group: "IT102-26", created_by: 2, created_at: iso(weekStart - DAY),
});
assignments.forEach((a) =>
  events.push({
    id: eventId++, course: a.course, title: `Dedlayn: ${a.title}`, description: "", event_type: "assignment_deadline",
    start_time: a.deadline, end_time: iso(new Date(a.deadline).getTime() + 30 * MIN), room: "", period: null,
    for_group: "All", created_by: 2, created_at: a.created_at,
  }),
);
const eventOut = (e: Row) => ({ ...e, course_title: courseTitle(e.course) });

// ---------- Davomat ----------
const sessions: Row[] = [];
const records: Row[] = [];
let sessionId = 1;
let recordId = 1;
const statuses = ["present", "present", "present", "late", "present", "absent", "present", "excused"];
events
  .filter((e) => e.event_type === "lesson" && new Date(e.end_time).getTime() < now)
  .forEach((e) => {
    const sid = sessionId++;
    sessions.push({
      id: sid, calendar_event: e.id, course: e.course, starts_at: e.start_time, topic: e.title,
      automated_checkin: false, attendance_minutes: 60, late_after_minutes: 10, location_latitude: null,
      location_longitude: null, location_radius_m: 80, max_location_accuracy_m: 100, ended_at: e.end_time,
    });
    students().forEach((s, i) => {
      const status = s.username === "talaba_demo" ? (sid % 5 === 0 ? "late" : "present") : statuses[(i + sid) % statuses.length];
      records.push({
        id: recordId++, session: sid, student: s.id, status, note: status === "excused" ? "Kasallik" : "",
        source: "manual", checked_at: e.start_time, last_seen_at: status === "present" || status === "late" ? e.start_time : null,
        presence_samples: status === "present" || status === "late" ? 1 : 0, distance_m: null, location_accuracy_m: null,
      });
    });
  });
const sessionOut = (s: Row) => {
  const ev = s.calendar_event ? events.find((e) => e.id === s.calendar_event) : null;
  const start = new Date(s.starts_at).getTime();
  return {
    id: s.id, calendar_event: s.calendar_event, course: s.course, course_title: courseTitle(s.course), starts_at: s.starts_at,
    topic: s.topic, automated_checkin: s.automated_checkin, attendance_minutes: s.attendance_minutes,
    late_after_minutes: s.late_after_minutes, location_latitude: s.location_latitude, location_longitude: s.location_longitude,
    location_radius_m: s.location_radius_m, max_location_accuracy_m: s.max_location_accuracy_m, ended_at: s.ended_at,
    check_in_ends_at: iso(start + s.attendance_minutes * MIN), late_after_at: iso(start + s.late_after_minutes * MIN),
    lesson_ends_at: ev ? ev.end_time : iso(start + 70 * MIN), student_count: courseById(s.course)?.studentIds.length ?? 0,
  };
};
const recordOut = (r: Row) => {
  const s = sessions.find((x) => x.id === r.session)!;
  return {
    id: r.id, student: r.student, student_name: userById(r.student).fullname, status: r.status, note: r.note,
    session_topic: s.topic, starts_at: s.starts_at, course_title: courseTitle(s.course), source: r.source,
    checked_at: r.checked_at, last_seen_at: r.last_seen_at, presence_samples: r.presence_samples,
    presence_state: r.status === "absent" || r.status === "excused" ? r.status : "finished",
    distance_m: r.distance_m, location_accuracy_m: r.location_accuracy_m,
  };
};

// ---------- Bildirishnomalar ----------
const notifications: Row[] = [
  { id: 1, user: 3, type: "grade", title: "Topshiriq baholandi", message: "Python: kalkulyator: 92 / 100", link: "/grades", is_read: false, created_at: iso(now - 2 * 3600_000) },
  { id: 2, user: 3, type: "assignment", title: "Yangi topshiriq", message: "Shaxsiy portfolio sahifasi", link: "/assignments", is_read: false, created_at: iso(now - DAY) },
  { id: 3, user: 3, type: "material", title: "Yangi material", message: "SQL so‘rovlari bo‘yicha amaliy mashqlar", link: "/courses", is_read: true, created_at: iso(now - 3 * DAY) },
  { id: 4, user: 2, type: "submission", title: "Yangi topshiriq javobi", message: "Aliyev Azizbek — JavaScript: to-do ilovasi", link: "/manage", is_read: false, created_at: iso(now - 3600_000) },
  { id: 5, user: 2, type: "submission", title: "Yangi topshiriq javobi", message: "Karimova Nilufar — Shaxsiy portfolio sahifasi", link: "/manage", is_read: false, created_at: iso(now - 5 * 3600_000) },
  { id: 6, user: 1, type: "system", title: "Demo rejim", message: "Bu demo ma’lumotlar bilan ishlaydigan namoyish.", link: "", is_read: false, created_at: iso(now - 60_000) },
];

// ---------- Demo-only bo‘limlar (haqiqiy backendda yo‘q): moliya, murojaatlar, tadbirlar ----------
const finance = {
  academic_year: "2026–2027",
  contract_amount: 28_000_000,
  grant_percent: 50,
  grant_name: "Akademik grant (GPA 4.5+)",
  scholarship_monthly: 1_050_000,
  payments: [
    { id: 1, date: iso(now - 70 * DAY), title: "Kontrakt — 1-semestr (50%)", amount: 7_000_000, status: "paid" },
    { id: 2, date: iso(now - 20 * DAY), title: "Kontrakt — 2-chorak", amount: 3_500_000, status: "paid" },
    { id: 3, date: iso(now + 12 * DAY), title: "Kontrakt — 3-chorak", amount: 3_500_000, status: "due" },
    { id: 4, date: iso(now + 75 * DAY), title: "Kontrakt — 4-chorak", amount: 3_500_000, status: "upcoming" },
  ],
};
const requestRows: Row[] = [
  { id: 1, type: "Talabalik ma’lumotnomasi", language: "O‘zbek", purpose: "Bank uchun", status: "ready", created_at: iso(now - 9 * DAY), updated_at: iso(now - 7 * DAY), subject: "Ma’lumotnoma so‘rovi", description: "Bank kartasi uchun kerak.", user: 3 },
  { id: 2, type: "Akademik ma’lumotnoma", language: "Ingliz", purpose: "Almashinuv dasturi", status: "processing", created_at: iso(now - 2 * DAY), updated_at: iso(now - DAY), subject: "Transkript (ingliz tilida)", description: "", user: 3 },
];
const campusEvents: Row[] = [
  { id: 1, title: "Hackathon: Smart Campus", category: "Texnologiya", starts_at: iso(now + 5 * DAY), location: "Katta zal, A blok", description: "24 soatlik jamoaviy hackathon. Eng yaxshi loyihalar mukofotlanadi.", seats: 80, registered: 54 },
  { id: 2, title: "Karyera kuni", category: "Karyera", starts_at: iso(now + 9 * DAY), location: "Markaziy maydon", description: "20+ kompaniya vakillari bilan uchrashuv va suhbatlar.", seats: 300, registered: 188 },
  { id: 3, title: "Ochiq ma’ruza: Sun’iy intellekt kelajagi", category: "Ma’ruza", starts_at: iso(now + 15 * DAY), location: "B-201 auditoriya", description: "Mehmon spiker bilan ochiq muloqot.", seats: 120, registered: 71 },
  { id: 4, title: "Talabalar sport musobaqasi", category: "Sport", starts_at: iso(now + 22 * DAY), location: "Sport majmuasi", description: "Mini-futbol va stol tennisi turnirlari.", seats: 150, registered: 96 },
];
const eventRegs = new Set<number>([3]);
const eventsOut = () => campusEvents.map((e) => ({ ...e, registered: e.registered + (eventRegs.has(e.id) ? 1 : 0), is_registered: eventRegs.has(e.id) }));

// ---------- Sessiya ----------
const SESSION_KEY = "mu-demo-user";
let currentUserId: number | null = null;
function loadSession() {
  if (currentUserId !== null) return;
  try {
    const raw = typeof window !== "undefined" ? window.sessionStorage.getItem(SESSION_KEY) : null;
    if (raw) currentUserId = Number(raw);
  } catch {}
}
function saveSession() {
  try {
    if (currentUserId === null) window.sessionStorage.removeItem(SESSION_KEY);
    else window.sessionStorage.setItem(SESSION_KEY, String(currentUserId));
  } catch {}
}
function me(): Row {
  loadSession();
  const u = currentUserId ? users.find((x) => x.id === currentUserId) : null;
  if (!u) throw new DemoError("Sessiya tugadi. Qayta kiring.", 401);
  return u;
}
const isTeacher = (u: Row) => u.role === "ustoz" || u.role === "admin";
const needTeacher = (u: Row) => {
  if (!isTeacher(u)) throw new DemoError("Bu amal faqat ustoz yoki administrator uchun.", 403);
};
const needAdmin = (u: Row) => {
  if (u.role !== "admin") throw new DemoError("Bu amal faqat administrator uchun.", 403);
};

export const demoRestoreSession = async () => {
  me();
};
export const demoLogout = async () => {
  currentUserId = null;
  saveSession();
};

// ---------- So'rov marshruti ----------
function parseBody(options: RequestInit): Row {
  const body = options.body;
  if (!body) return {};
  if (body instanceof FormData) {
    const out: Row = {};
    body.forEach((v, k) => {
      out[k] = v instanceof File ? v : String(v);
    });
    return out;
  }
  try {
    return JSON.parse(String(body));
  } catch {
    return {};
  }
}

export async function demoFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  await new Promise((r) => setTimeout(r, 120));
  const method = (options.method ?? "GET").toUpperCase();
  const [path] = endpoint.split("?");
  const query = new URLSearchParams(endpoint.split("?")[1] ?? "");
  const body = parseBody(options);
  const seg = path.split("/").filter(Boolean);
  const num = (i: number) => Number(seg[i]);
  const at = (...parts: string[]) => parts.every((p, i) => (p === "#" ? /^\d+$/.test(seg[i] ?? "") : seg[i] === p)) && seg.length === parts.length;

  if (at("health")) return { status: "ok", demo: true };
  if (at("login")) {
    const wanted = String(body.username ?? "").trim().toLowerCase();
    const u = ["admin_demo", "ustoz_demo", "talaba_demo"].includes(wanted) ? users.find((x) => x.username === wanted) : undefined;
    if (!u) throw new DemoError("Demo rejimda faqat admin_demo, ustoz_demo yoki talaba_demo bilan kiriladi.", 401);
    currentUserId = u.id;
    saveSession();
    return { access: "demo-token", user: { id: u.id, username: u.username, role: u.role } };
  }
  if (at("account", "recover")) throw new DemoError("Demo rejimda hisobni tiklash o‘chirilgan.", 400);
  if (at("token", "refresh")) {
    me();
    return { access: "demo-token" };
  }
  if (at("logout")) {
    await demoLogout();
    return null;
  }

  const user = me();

  // Demo-only bo‘limlar
  if (at("finance")) return finance;
  if (seg[0] === "requests") {
    if (method === "POST") {
      const r: Row = { id: requestRows.length + 1, type: String(body.type || "Boshqa"), language: String(body.language || "O‘zbek"), purpose: String(body.purpose || ""), subject: String(body.subject || ""), description: String(body.description || ""), status: "new", created_at: iso(Date.now()), updated_at: iso(Date.now()), user: user.id };
      requestRows.unshift(r);
      return r;
    }
    return requestRows.filter((r) => r.user === user.id || user.role !== "student");
  }
  if (seg[0] === "campus-events") {
    if (method === "POST" && seg[2] === "register") {
      const id = num(1);
      if (eventRegs.has(id)) eventRegs.delete(id);
      else eventRegs.add(id);
      return eventsOut();
    }
    return eventsOut();
  }

  // Profil
  if (seg[0] === "user" && seg[1] === "profile") {
    if (method === "PATCH" || method === "PUT") {
      for (const k of ["fullname", "email", "bio"]) if (k in body) user[k] = String(body[k]);
    }
    return omit(user, ["telegram_chat_id", "is_active"]);
  }
  if (at("user", "password", "change")) return { access: "demo-token" };

  // Admin
  if (at("admin", "stats")) {
    needAdmin(user);
    const staff = users.filter((u) => u.role !== "admin");
    return {
      users_total: staff.length,
      students_active: students().filter((u) => u.is_active).length,
      teachers_active: users.filter((u) => u.role === "ustoz" && u.is_active).length,
      users_inactive: staff.filter((u) => !u.is_active).length,
      courses_active: courses.filter((c) => !c.is_archived).length,
      courses_archived: courses.filter((c) => c.is_archived).length,
      assignments_total: assignments.length,
      submissions_pending: submissions.filter((s) => s.grade === null).length,
      lessons_today: events.filter((e) => e.event_type === "lesson" && new Date(e.start_time).toDateString() === new Date().toDateString()).length,
      attendance_sessions_today: sessions.filter((s) => new Date(s.starts_at).toDateString() === new Date().toDateString()).length,
    };
  }
  if (seg[0] === "admin" && seg[1] === "users") {
    needAdmin(user);
    const out = (u: Row) => omit(u, ["bio", "telegram_connected"]);
    if (seg.length === 2 && method === "GET") return users.filter((u) => u.role !== "admin").map(out);
    if (seg.length === 2 && method === "POST") {
      if (users.some((u) => u.username === body.username)) throw new DemoError("username: Bu foydalanuvchi nomi band.", 400);
      const u = mkUser(Math.max(...users.map((x) => x.id)) + 1, String(body.username), String(body.fullname), body.role === "ustoz" ? "ustoz" : "student");
      Object.assign(u, { email: body.email ?? u.email, student_id: body.student_id || null, group_code: body.group_code ?? "", phone_number: body.phone_number ?? "", must_change_password: true });
      users.push(u);
      return out(u);
    }
    if (seg.length === 3 && method === "PATCH") {
      const u = userById(num(2));
      if (!u) throw new DemoError("Topilmadi.", 404);
      for (const k of ["fullname", "username", "role", "email", "student_id", "group_code", "phone_number", "is_active"]) if (k in body) u[k] = body[k];
      return out(u);
    }
  }

  // Kurslar
  if (seg[0] === "courses") {
    if (seg.length === 1 && method === "GET") {
      const list = user.role === "student" ? courses.filter((c) => c.studentIds.includes(user.id)) : user.role === "ustoz" ? courses.filter((c) => c.teacher === user.id) : courses;
      return list.map(courseOut);
    }
    if (seg.length === 1 && method === "POST") {
      needTeacher(user);
      const teacher = user.role === "admin" ? Number(body.teacher) || 2 : user.id;
      const c: Row = { id: Math.max(0, ...courses.map((x) => x.id)) + 1, code: String(body.code), title: String(body.title), description: String(body.description ?? ""), teacher, is_archived: false, created_at: iso(Date.now()), studentIds: [] };
      if (courses.some((x) => x.code === c.code)) throw new DemoError("code: Bu kod band.", 400);
      courses.push(c);
      return courseOut(c);
    }
    const c = courseById(num(1));
    if (!c) throw new DemoError("Topilmadi.", 404);
    if (seg.length === 2) {
      if (method === "PATCH") {
        needTeacher(user);
        for (const k of ["title", "code", "description", "is_archived"]) if (k in body) c[k] = body[k];
      }
      return courseOut(c);
    }
    if (seg[2] === "students") {
      needTeacher(user);
      const out = (u: Row) => ({ id: u.id, username: u.username, fullname: u.fullname, student_id: u.student_id, group_code: u.group_code, phone_number: u.phone_number, is_active: u.is_active });
      if (seg.length === 3 && method === "GET") return c.studentIds.map((id: number) => out(userById(id))).sort((a: Row, b: Row) => a.fullname.localeCompare(b.fullname));
      if (seg.length === 3 && method === "POST") {
        const s = users.find((u) => u.username === body.username && u.role === "student");
        if (!s) throw new DemoError("username: Bunday talaba topilmadi.", 404);
        if (!c.studentIds.includes(s.id)) c.studentIds.push(s.id);
        return { id: s.id, fullname: s.fullname };
      }
      if (seg.length === 4 && method === "DELETE") {
        c.studentIds = c.studentIds.filter((id: number) => id !== num(3));
        return null;
      }
    }
  }

  // Topshiriqlar
  if (seg[0] === "assignments") {
    if ((seg.length === 1 && method === "GET")) return assignments.map((a) => asgOut(a, user));
    if ((seg.length === 2 && seg[1] === "create") || (seg.length === 1 && method === "POST")) {
      needTeacher(user);
      const a: Row = {
        id: Math.max(0, ...assignments.map((x) => x.id)) + 1, course: Number(body.course), title: String(body.title), description: String(body.description ?? ""),
        file: null, deadline: String(body.deadline), teacher: user.id, max_attempts: Number(body.max_attempts) || 3, allow_late: !!body.allow_late,
        created_at: iso(Date.now()), updated_at: iso(Date.now()),
      };
      assignments.push(a);
      return asgOut(a, user);
    }
    const a = assignments.find((x) => x.id === num(1));
    if (!a) throw new DemoError("Topilmadi.", 404);
    if (seg.length === 2) {
      if (method === "PATCH") {
        needTeacher(user);
        for (const k of ["title", "description", "deadline", "max_attempts", "allow_late"]) if (k in body) a[k] = body[k];
        a.updated_at = iso(Date.now());
      }
      if (method === "DELETE") {
        needTeacher(user);
        assignments.splice(assignments.indexOf(a), 1);
        return null;
      }
      return asgOut(a, user);
    }
    if (seg[2] === "submissions") {
      const rows = submissions.filter((s) => s.assignment === a.id && (isTeacher(user) || s.student === user.id));
      return rows.map(subOut);
    }
    if (seg[2] === "submit" && method === "POST") {
      if (user.role !== "student") throw new DemoError("Javobni faqat talaba yuboradi.", 403);
      const used = submissions.filter((s) => s.assignment === a.id && s.student === user.id).length;
      if (!a.allow_late && Date.now() > new Date(a.deadline).getTime()) throw new DemoError("non_field_errors: Topshirish muddati tugagan.", 400);
      if (used >= a.max_attempts) throw new DemoError("non_field_errors: Yuborish urinishlari tugagan.", 400);
      const file = body.file as File | undefined;
      const s: Row = { id: submissionId++, assignment: a.id, student: user.id, file: `/media/submissions/${file?.name ?? "demo.zip"}`, submitted_at: iso(Date.now()), grade: null, graded_at: null, feedback: "", attempt: used + 1 };
      submissions.push(s);
      return subOut(s);
    }
  }

  // Materiallar
  if (seg[0] === "books") {
    if (seg.length === 1 && method === "GET") return books.map(bookOut);
    if ((seg.length === 2 && seg[1] === "create") || (seg.length === 1 && method === "POST")) {
      needTeacher(user);
      const file = body.file as File | undefined;
      const b: Row = { id: Math.max(0, ...books.map((x) => x.id)) + 1, course: Number(body.course), title: String(body.title), subject: String(body.subject ?? ""), file: `/media/books/${file?.name ?? "demo.pdf"}`, uploaded_by: user.id, uploaded_at: iso(Date.now()) };
      books.push(b);
      return bookOut(b);
    }
    const b = books.find((x) => x.id === num(1));
    if (!b) throw new DemoError("Topilmadi.", 404);
    if (method === "PATCH") {
      needTeacher(user);
      for (const k of ["title", "subject"]) if (k in body) b[k] = body[k];
    }
    if (method === "DELETE") {
      needTeacher(user);
      books.splice(books.indexOf(b), 1);
      return null;
    }
    return bookOut(b);
  }

  // Taqvim
  if (seg[0] === "calendar") {
    if (seg.length === 1 && method === "GET") return events.map(eventOut);
    if ((seg.length === 2 && seg[1] === "create") || (seg.length === 1 && method === "POST")) {
      needTeacher(user);
      const e: Row = {
        id: Math.max(0, ...events.map((x) => x.id)) + 1, course: Number(body.course), title: String(body.title), description: String(body.description ?? ""),
        event_type: body.event_type ?? "lesson", start_time: String(body.start_time), end_time: String(body.end_time), room: String(body.room ?? ""),
        period: body.period ? Number(body.period) : null, for_group: body.for_group ?? null, created_by: user.id, created_at: iso(Date.now()),
      };
      if (new Date(e.end_time) <= new Date(e.start_time)) throw new DemoError("end_time: Tugash vaqti boshlanishdan keyin bo‘lsin.", 400);
      events.push(e);
      return eventOut(e);
    }
    const e = events.find((x) => x.id === num(1));
    if (!e) throw new DemoError("Topilmadi.", 404);
    if (method === "DELETE") {
      needTeacher(user);
      events.splice(events.indexOf(e), 1);
      return null;
    }
    return eventOut(e);
  }

  // Baholar
  if (at("grades", "my")) return submissions.filter((s) => s.student === user.id && s.grade !== null).map(subOut);
  if (at("grades", "teacher")) {
    needTeacher(user);
    let rows = submissions;
    if (query.get("course")) rows = rows.filter((s) => assignments.find((a) => a.id === s.assignment)?.course === Number(query.get("course")));
    if (query.get("pending") === "1") rows = rows.filter((s) => s.grade === null);
    return rows.map(subOut);
  }
  if ((seg[0] === "grades" && seg[2] === "set") || (seg[0] === "submissions" && seg[2] === "grade")) {
    needTeacher(user);
    const s = submissions.find((x) => x.id === num(1));
    if (!s) throw new DemoError("Topilmadi.", 404);
    const grade = Number(body.grade);
    if (Number.isNaN(grade) || grade < 0 || grade > 100) throw new DemoError("grade: Baho 0 dan 100 gacha bo‘lsin.", 400);
    s.grade = grade;
    s.feedback = String(body.feedback ?? "");
    s.graded_at = iso(Date.now());
    return subOut(s);
  }

  // Davomat
  if (seg[0] === "lessons" && seg[2] === "attendance") {
    needTeacher(user);
    const ev = events.find((e) => e.id === num(1));
    if (!ev) throw new DemoError("Topilmadi.", 404);
    let session = sessions.find((s) => s.calendar_event === ev.id);
    if (method === "POST") {
      if (!session) {
        session = {
          id: sessionId++, calendar_event: ev.id, course: ev.course, starts_at: iso(Math.min(Date.now(), new Date(ev.start_time).getTime())), topic: ev.title,
          automated_checkin: true, attendance_minutes: 60, late_after_minutes: 10, location_latitude: body.latitude ?? null, location_longitude: body.longitude ?? null,
          location_radius_m: 80, max_location_accuracy_m: 100, ended_at: null,
        };
        sessions.push(session);
      }
    }
    return { event: eventOut(ev), session: session ? sessionOut(session) : null };
  }
  if (seg[0] === "attendance") {
    if (at("attendance", "my")) return records.filter((r) => r.student === user.id).sort((a, b) => +new Date(sessions.find((s) => s.id === b.session)!.starts_at) - +new Date(sessions.find((s) => s.id === a.session)!.starts_at)).map(recordOut);
    if (at("attendance", "active")) return [];
    if (at("attendance", "check-in")) throw new DemoError("Demo rejimda QR/lokatsiya orqali davomat belgilash o‘chirilgan.", 400);
    if (at("attendance", "presence")) return { ok: true };
    needTeacher(user);
    if (seg.length === 1 && method === "GET") return sessions.map(sessionOut);
    if (seg.length === 1 && method === "POST") {
      const s: Row = {
        id: sessionId++, calendar_event: null, course: Number(body.course), starts_at: String(body.starts_at), topic: String(body.topic ?? ""), automated_checkin: !!body.automated_checkin,
        attendance_minutes: Number(body.attendance_minutes) || 60, late_after_minutes: Number(body.late_after_minutes) || 10, location_latitude: body.location_latitude ?? null,
        location_longitude: body.location_longitude ?? null, location_radius_m: Number(body.location_radius_m) || 80, max_location_accuracy_m: Number(body.max_location_accuracy_m) || 100, ended_at: null,
      };
      sessions.push(s);
      return sessionOut(s);
    }
    const s = sessions.find((x) => x.id === num(1));
    if (!s) throw new DemoError("Topilmadi.", 404);
    if (seg.length === 2) {
      if (method === "PUT") {
        const items: Row[] = Array.isArray(body.records) ? body.records : [];
        const ids = items.map((i) => Number(i.student));
        for (let i = records.length - 1; i >= 0; i--) if (records[i].session === s.id && !ids.includes(records[i].student)) records.splice(i, 1);
        items.forEach((item) => {
          const existing = records.find((r) => r.session === s.id && r.student === Number(item.student));
          const present = item.status === "present" || item.status === "late";
          const data = { status: item.status, note: item.note ?? "", source: "manual", checked_at: iso(Date.now()), last_seen_at: present ? iso(Date.now()) : null, presence_samples: present ? 1 : 0 };
          if (existing) Object.assign(existing, data);
          else records.push({ id: recordId++, session: s.id, student: Number(item.student), distance_m: null, location_accuracy_m: null, ...data });
        });
      }
      return records.filter((r) => r.session === s.id).map(recordOut);
    }
    if (seg[2] === "roster") return (courseById(s.course)?.studentIds ?? []).map((id: number) => { const u = userById(id); return { id: u.id, username: u.username, fullname: u.fullname, student_id: u.student_id, group_code: u.group_code, phone_number: u.phone_number, is_active: u.is_active }; });
    if (seg[2] === "manual" && method === "POST") {
      const sid = Number(body.student);
      let r = records.find((x) => x.session === s.id && x.student === sid);
      const present = body.status === "present" || body.status === "late";
      const data = { status: body.status, note: body.note ?? "", source: "manual", checked_at: iso(Date.now()), last_seen_at: present ? iso(Date.now()) : null, presence_samples: present ? 1 : 0 };
      if (r) Object.assign(r, data);
      else { r = { id: recordId++, session: s.id, student: sid, distance_m: null, location_accuracy_m: null, ...data }; records.push(r); }
      return recordOut(r);
    }
    if (seg[2] === "challenge") {
      if (!s.automated_checkin) throw new DemoError("Bu mashg‘ulotda avtomatik davomat yoqilmagan.", 400);
      const start = new Date(s.starts_at).getTime();
      return {
        session: s.id, course: s.course, course_code: courseById(s.course)?.code, course_title: courseTitle(s.course), topic: s.topic,
        manual_code: String(100000 + ((s.id * 7919 + Math.floor(Date.now() / 15000)) % 900000)), qr_proof: `demo-qr-${s.id}-${Math.floor(Date.now() / 15000)}`,
        ultrasound_code: `demo-us-${s.id}`, refresh_seconds: 15, starts_at: s.starts_at, late_after_at: iso(start + s.late_after_minutes * MIN),
        check_in_ends_at: iso(start + s.attendance_minutes * MIN), lesson_ends_at: iso(start + 70 * MIN), server_time: iso(Date.now()), is_open: true,
      };
    }
  }

  // Bildirishnomalar
  if (seg[0] === "notifications") {
    const mine = notifications.filter((n) => n.user === user.id);
    const out = (n: Row) => omit(n, ["user"]);
    if (seg.length === 1) return mine.filter((n) => query.get("unread") !== "1" || !n.is_read).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).map(out);
    if (seg[1] === "read-all") {
      const unread = mine.filter((n) => !n.is_read);
      unread.forEach((n) => (n.is_read = true));
      return { updated: unread.length };
    }
    if (seg[2] === "read") {
      const n = mine.find((x) => x.id === num(1));
      if (!n) throw new DemoError("Topilmadi.", 404);
      n.is_read = true;
      return out(n);
    }
  }

  throw new DemoError(`Demo rejimda bu so‘rov qo‘llab-quvvatlanmaydi: ${method} /${path}`, 404);
}

export function demoDownload(path: string) {
  const name = decodeURIComponent(path.split("/").pop() || "demo.txt");
  const blob = new Blob([`MU LMS demo fayli\n\nBu demo rejimda yaratilgan namunaviy fayl: ${name}\n`], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name.replace(/\.[^.]+$/, "") + ".txt";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
