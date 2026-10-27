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
    birth_date: role === "student" ? `200${n % 4 + 5}-${String((n % 12) + 1).padStart(2, "0")}-${String((n * 3) % 27 + 1).padStart(2, "0")}` : null,
    program: role === "student" ? "IT-NATIONAL (2026–2027)" : "",
    faculty: role === "student" ? "Axborot texnologiyalari va sun’iy intellekt" : "Axborot texnologiyalari kafedrasi",
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
  module: null as number | null,
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
    submitted_students: new Set(submissions.filter((s) => s.assignment === a.id).map((s) => s.student)).size,
    graded_count: submissions.filter((s) => s.assignment === a.id && s.grade !== null).length,
    student_count: courseById(a.course)?.studentIds.length ?? 0,
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
const periodStarts: Record<number, [number, number]> = { 1: [8, 0], 2: [9, 20], 3: [10, 40], 4: [12, 30], 5: [13, 50], 6: [15, 10], 7: [16, 30] };
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
    lesson_type: (course + day) % 2 ? "lecture" : "seminar",
    for_group: course % 3 === 0 ? "IT102-26, IT102-27" : "IT102-26",
    created_by: 2,
    created_at: iso(weekStart - DAY),
  });
});
// Test uchun: hozir boshlangan 24 soatlik dars (davomatni sinab ko‘rish mumkin).
const longStart = now - 5 * MIN;
events.push({
  id: eventId++, course: 1, title: "Test dars (24 soat)", description: "Davomatni sinash uchun 24 soat ochiq dars.",
  event_type: "lesson", start_time: iso(longStart), end_time: iso(longStart + 24 * 3600_000), room: "A-301", period: null,
  for_group: "IT102-26", created_by: 2, created_at: iso(now - DAY),
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
// Talabalar uchun turlicha davomat: har 5-talaba xavf ostida (ko‘p qoldiradi).
const pickStatus = (i: number, sid: number) => {
  const roll = (i * 37 + sid * 53 + i * sid * 7) % 100;
  const absent = i % 5 === 0 ? 38 : i % 7 === 3 ? 18 : 3;
  if (roll < absent) return "absent";
  if (roll < absent + 6) return "excused";
  if (roll < absent + 16) return "late";
  return "present";
};
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
      const status = s.username === "talaba_demo" ? (sid % 4 === 1 ? "absent" : sid % 9 === 2 ? "excused" : sid % 5 === 0 ? "late" : "present") : pickStatus(i, sid);
      records.push({
        id: recordId++, session: sid, student: s.id, status, note: status === "excused" ? "Kasallik" : "",
        source: "manual", checked_at: e.start_time, last_seen_at: status === "present" || status === "late" ? e.start_time : null,
        presence_samples: status === "present" || status === "late" ? 1 : 0, distance_m: null, location_accuracy_m: null,
      });
    });
  });
// Demo: 24 soatlik test darsi uchun davomat sessiyasi oldindan ochiq turadi —
// shunda boshqa telefondagi talaba ham uni ko‘radi va ultratovush/QR/kod bilan tasdiqlay oladi.
{
  const ev = events.find((e) => e.title === "Test dars (24 soat)");
  if (ev) sessions.push({
    id: sessionId++, calendar_event: ev.id, course: ev.course, starts_at: ev.start_time, topic: ev.title, automated_checkin: true,
    attendance_minutes: 24 * 60, late_after_minutes: 60, location_latitude: null, location_longitude: null, location_radius_m: 80,
    max_location_accuracy_m: 100, ended_at: null,
  });
}
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
  contract_amount: 18_000_000,
  grant_percent: 10,
  grant_name: "Kirish imtihoni granti",
  due_amount: 3_300_000,
  due_date: iso(now + 12 * DAY),
  breakdown: [
    { label: "Yillik kontrakt (2026–2027)", amount: 18_000_000 },
    { label: "1-semestr uchun hisoblangan (50%)", amount: 9_000_000 },
    { label: "Grant chegirmasi (10%)", amount: -900_000 },
    { label: "O‘tgan davrdan qoldiq (ortiqcha to‘lov)", amount: -4_800_000 },
  ],
  operations: [
    {
      year: "2026–2027", accrued: 9_000_000, paid: 0,
      items: [
        { id: 1, title: "Kontrakt to‘lovi", note: "Ta’lim xizmati · 1-semestr", date: iso(now - 21 * DAY), amount: -9_000_000 },
        { id: 2, title: "Chegirma (grant 10%)", note: "Kirish imtihoni natijasi", date: iso(now - 21 * DAY), amount: 900_000 },
      ],
    },
    { year: "Oldingi davr", accrued: 0, paid: 0, items: [{ id: 3, title: "O‘tgan davrdan qoldiq", note: "Ortiqcha to‘lov", date: iso(now - 120 * DAY), amount: 4_800_000 }] },
  ],
  grants: [
    { id: 1, title: "2026–2027 · 1-semestr", status: "granted", percent: 10, description: "Kirish imtihoni: matematika 64 ball — avtomatik 10% grant. Shartnoma tasdiqlangan." },
    { id: 2, title: "Akademik grant (2-semestr)", status: "open", percent: 50, description: "GPA 4.5 va undan yuqori, davomat 90%+ bo‘lsa ariza topshirish mumkin." },
  ],
  payments: [{ id: 1, date: iso(now + 12 * DAY), title: "1-semestr qoldig‘i", amount: 3_300_000, status: "due" }],
};
const requestRows: Row[] = [
  { id: 1, kind: "Ma’lumotnoma", document: "O‘qish joyidan ma’lumotnoma", files: [], type: "O‘qish joyidan ma’lumotnoma", language: "O‘zbek", purpose: "Bank uchun", status: "ready", created_at: iso(now - 9 * DAY), updated_at: iso(now - 7 * DAY), subject: "Ma’lumotnoma so‘rovi", description: "Bank kartasi uchun kerak.", user: 3 },
  { id: 2, kind: "Ma’lumotnoma", document: "Ta’lim tili / taxminiy bitirish xati", files: [], type: "Ta’lim tili / taxminiy bitirish xati", language: "Ingliz", purpose: "Almashinuv dasturi", status: "processing", created_at: iso(now - 2 * DAY), updated_at: iso(now - DAY), subject: "Transkript (ingliz tilida)", description: "", user: 3 },
];
requestRows.push(
  { id: 3, kind: "Ariza", document: "Akademik ta’til", files: ["tibbiy_xulosa.pdf"], type: "Akademik ta’til", language: "", purpose: "", status: "new", created_at: iso(now - 5 * 3600_000), updated_at: iso(now - 5 * 3600_000), subject: "Sog‘lig‘im sababli akademik ta’til", description: "Shifokor xulosasi ilova qilindi.", user: 6 },
  { id: 4, kind: "Ma’lumotnoma", document: "Work & Travel xati", files: [], type: "Work & Travel xati", language: "Inglizcha", purpose: "Elchixona", status: "new", created_at: iso(now - DAY), updated_at: iso(now - DAY), subject: "Work & Travel uchun xat", description: "", user: 9 },
  { id: 5, kind: "Ariza", document: "Guruhni almashtirish", files: [], type: "Guruhni almashtirish", language: "", purpose: "", status: "processing", created_at: iso(now - 2 * DAY), updated_at: iso(now - DAY), subject: "IT102-27 ga o‘tish", description: "Ingliz tilidagi guruhda o‘qimoqchiman.", user: 12 },
);
const campusEvents: Row[] = [
  { id: 1, title: "Hackathon: Smart Campus", category: "Texnologiya", starts_at: iso(now + 5 * DAY), location: "Katta zal, A blok", description: "24 soatlik jamoaviy hackathon. Eng yaxshi loyihalar mukofotlanadi.", seats: 80, registered: 54 },
  { id: 2, title: "Karyera kuni", category: "Karyera", starts_at: iso(now + 9 * DAY), location: "Markaziy maydon", description: "20+ kompaniya vakillari bilan uchrashuv va suhbatlar.", seats: 300, registered: 188 },
  { id: 3, title: "Ochiq ma’ruza: Sun’iy intellekt kelajagi", category: "Ma’ruza", starts_at: iso(now + 15 * DAY), location: "B-201 auditoriya", description: "Mehmon spiker bilan ochiq muloqot.", seats: 120, registered: 71 },
  { id: 4, title: "Talabalar sport musobaqasi", category: "Sport", starts_at: iso(now + 22 * DAY), location: "Sport majmuasi", description: "Mini-futbol va stol tennisi turnirlari.", seats: 150, registered: 96 },
];
const eventRegs = new Set<number>([3]);
const eventsOut = () => campusEvents.map((e) => ({ ...e, registered: e.registered + (eventRegs.has(e.id) ? 1 : 0), is_registered: eventRegs.has(e.id) }));

// ---------- Demo-only: admin — fakultet va guruhlar ----------
const faculties: Row[] = [
  { id: 1, name: "Axborot texnologiyalari va sun’iy intellekt", short: "IT" },
  { id: 2, name: "Biznes va boshqaruv", short: "BUS" },
  { id: 3, name: "Pedagogika va tillar", short: "EDU" },
];
const groups: Row[] = [
  { id: 1, code: "IT102-26", faculty: 1, year: 1, language: "O‘zbek", curator: 2 },
  { id: 2, code: "IT102-27", faculty: 1, year: 1, language: "Ingliz", curator: 2 },
  { id: 3, code: "BUS101-26", faculty: 2, year: 1, language: "O‘zbek", curator: null },
  { id: 4, code: "EDU201-25", faculty: 3, year: 2, language: "Rus", curator: null },
];
const groupOut = (g: Row) => ({
  ...g, faculty_name: faculties.find((f) => f.id === g.faculty)?.name, curator_name: g.curator ? userById(g.curator).fullname : null,
  student_count: users.filter((u) => u.role === "student" && u.group_code === g.code).length,
});

// ---------- Demo-only: modullar, testlar, imtihonlar ----------
const moduleTitles: Record<number, string[]> = {
  1: ["HTML asoslari", "CSS va moslashuvchan dizayn", "JavaScript asoslari", "DOM va hodisalar"],
  2: ["Relyatsion model", "SQL: SELECT", "JOIN va guruhlash", "Normallashtirish"],
  3: ["O‘zgaruvchilar va turlar", "Shartlar va sikllar", "Funksiyalar", "Modullar va fayllar"],
};
const modules: Row[] = [];
courses.forEach((c) => {
  const titles = moduleTitles[c.id] ?? ["Kirish", "Asosiy tushunchalar", "Amaliyot", "Yakuniy loyiha"];
  titles.forEach((t, i) => modules.push({ id: c.id * 10 + i + 1, course: c.id, week: i + 1, title: t, summary: `${i + 1}-hafta: ${t.toLowerCase()} bo‘yicha ma’ruza, amaliyot va mustaqil ish.` }));
});
const moduleFor = (course: number, i: number) => {
  const list = modules.filter((m) => m.course === course);
  return list[Math.min(i, list.length - 1)]?.id ?? null;
};
const q = (text: string, options: string[], correct: number) => ({ text, options, correct });
const quizzes: Row[] = [
  {
    id: 1, course: 1, module: 11, title: "HTML asoslari — test", time_limit_min: 10, max_attempts: 2, deadline: iso(now + 4 * DAY), created_at: iso(now - 3 * DAY),
    questions: [
      q("Sahifadagi eng katta sarlavha qaysi teg?", ["<h6>", "<h1>", "<header>", "<title>"], 1),
      q("Havola (link) qaysi teg bilan yoziladi?", ["<link>", "<href>", "<a>", "<url>"], 2),
      q("Rasm qo‘shish uchun qaysi atribut majburiy?", ["src", "href", "title", "class"], 0),
      q("Tartiblangan ro‘yxat qaysi?", ["<ul>", "<ol>", "<li>", "<dl>"], 1),
      q("Formadagi matn maydoni qaysi?", ["<input type=\"text\">", "<textbox>", "<field>", "<text>"], 0),
    ],
  },
  {
    id: 2, course: 2, module: 22, title: "SQL SELECT — viktorina", time_limit_min: 8, max_attempts: 1, deadline: iso(now + 6 * DAY), created_at: iso(now - 2 * DAY),
    questions: [
      q("Takrorlanmas qiymatlarni olish uchun?", ["UNIQUE", "DISTINCT", "SINGLE", "ONLY"], 1),
      q("Natijani saralash uchun?", ["SORT BY", "ORDER BY", "GROUP BY", "ARRANGE"], 1),
      q("Shart qo‘yish uchun qaysi kalit so‘z?", ["WHERE", "IF", "WHEN", "HAVING ONLY"], 0),
      q("Qatorlar sonini sanash funksiyasi?", ["SUM()", "COUNT()", "TOTAL()", "NUM()"], 1),
    ],
  },
  {
    id: 3, course: 3, module: 31, title: "Python: o‘zgaruvchilar", time_limit_min: 5, max_attempts: 3, deadline: iso(now - DAY), created_at: iso(now - 8 * DAY),
    questions: [
      q("type(3.0) natijasi?", ["int", "float", "str", "double"], 1),
      q("Ro‘yxat qaysi qavs bilan yoziladi?", ["()", "{}", "[]", "<>"], 2),
      q("Butun bo‘lish operatori?", ["/", "//", "%", "**"], 1),
    ],
  },
];
const quizAttempts: Row[] = [];
students().forEach((s, i) => {
  if (s.username === "talaba_demo") return;
  [3, 1].forEach((qid) => {
    if ((i + qid) % 3 === 0) return;
    const quiz = quizzes.find((x) => x.id === qid)!;
    const correct = Math.max(1, quiz.questions.length - ((i + qid) % 3));
    quizAttempts.push({ id: quizAttempts.length + 1, quiz: qid, student: s.id, correct, total: quiz.questions.length, score: Math.round((correct / quiz.questions.length) * 100), answers: [], finished_at: iso(now - ((i % 4) + 1) * 3600_000) });
  });
});
quizAttempts.push({ id: quizAttempts.length + 1, quiz: 3, student: 3, correct: 2, total: 3, score: 67, answers: [], finished_at: iso(now - 2 * DAY) });
const quizOut = (z: Row, viewer: Row) => {
  const mine = quizAttempts.filter((a) => a.quiz === z.id && a.student === viewer.id);
  const all = quizAttempts.filter((a) => a.quiz === z.id);
  return {
    id: z.id, course: z.course, course_title: courseTitle(z.course), module: z.module, title: z.title, time_limit_min: z.time_limit_min, max_attempts: z.max_attempts,
    deadline: z.deadline, question_count: z.questions.length, attempts_used: mine.length, best_score: mine.length ? Math.max(...mine.map((a) => a.score)) : null,
    attempt_count: all.length, average_score: all.length ? Math.round(all.reduce((x, a) => x + a.score, 0) / all.length) : null, is_overdue: Date.now() > new Date(z.deadline).getTime(),
  };
};

const exams: Row[] = [
  { id: 1, course: 2, kind: "Oraliq nazorat", starts_at: iso(weekStart + 9 * DAY + 10 * 3600_000), duration_min: 90, room: "B-204", seat: "14", format: "Yozma ish", max_score: 30, score: null },
  { id: 2, course: 1, kind: "Oraliq nazorat", starts_at: iso(weekStart + 11 * DAY + 9 * 3600_000), duration_min: 80, room: "A-301 (kompyuter xona)", seat: "7", format: "Amaliy (kompyuterda)", max_score: 30, score: null },
  { id: 3, course: 3, kind: "Oraliq nazorat", starts_at: iso(weekStart - 9 * DAY + 9 * 3600_000), duration_min: 60, room: "A-302", seat: "21", format: "Test", max_score: 30, score: 26 },
  { id: 4, course: 7, kind: "Yakuniy imtihon", starts_at: iso(weekStart + 51 * DAY + 9 * 3600_000), duration_min: 120, room: "Katta zal", seat: "—", format: "Test + og‘zaki", max_score: 50, score: null },
  { id: 5, course: 4, kind: "Yakuniy imtihon", starts_at: iso(weekStart + 53 * DAY + 13 * 3600_000), duration_min: 120, room: "B-205", seat: "—", format: "Yozma ish", max_score: 50, score: null },
];

// ---------- Demo-only: ustoz bo‘limlari (haqiqiy backendda yo‘q) ----------
const appeals: Row[] = [
  { id: 1, student: 5, assignment: 2, course: 1, reason: "Kod ishlaydi, lekin 2 ball kam qo‘yilgan deb o‘ylayman.", old_grade: 78, status: "pending", created_at: iso(now - 5 * 3600_000) },
  { id: 2, student: 8, assignment: 4, course: 3, reason: "Fayl noto‘g‘ri yuklangan edi, to‘g‘risini qayta yubordim.", old_grade: 70, status: "pending", created_at: iso(now - DAY) },
  { id: 3, student: 11, assignment: 2, course: 1, reason: "Izoh bo‘yicha tushuntirish so‘rayman.", old_grade: 84, status: "resolved", created_at: iso(now - 3 * DAY) },
];
const absenceRequests: Row[] = [
  { id: 1, student: 6, course: 2, date: iso(now - 2 * DAY), reason: "Kasallik (shifokor ma’lumotnomasi bor)", status: "pending" },
  { id: 2, student: 9, course: 1, date: iso(now - 4 * DAY), reason: "Oilaviy sabab", status: "pending" },
  { id: 3, student: 4, course: 3, date: iso(now - 6 * DAY), reason: "Sport musobaqasi", status: "approved" },
];
const questionBanks: Row[] = [
  { id: 1, course: 1, title: "HTML/CSS — test savollari", questions: 42, updated_at: iso(now - 2 * DAY) },
  { id: 2, course: 2, title: "SQL — oraliq nazorat banki", questions: 30, updated_at: iso(now - 5 * DAY) },
  { id: 3, course: 3, title: "Python asoslari — yakuniy", questions: 55, updated_at: iso(now - 9 * DAY) },
  { id: 4, course: 7, title: "Mashinaviy o‘rganish — viktorina", questions: 18, updated_at: iso(now - DAY) },
];
const grantInterviews: Row[] = [
  { id: 1, candidate: "Abituriyent A. (anonim)", starts_at: iso(now + 2 * DAY + 5 * 3600_000), room: "Qabul zali", status: "scheduled" },
  { id: 2, candidate: "Abituriyent B. (anonim)", starts_at: iso(now + 2 * DAY + 6 * 3600_000), room: "Qabul zali", status: "scheduled" },
  { id: 3, candidate: "Abituriyent C. (anonim)", starts_at: iso(now + 3 * DAY + 4 * 3600_000), room: "Onlayn", status: "scheduled" },
];
const sentMessages: Row[] = [];

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

  // Ustoz bo‘limlari (demo)
  if (seg[0] === "staff") {
    needTeacher(user);
    const what = seg[1];
    if (what === "appeals") {
      if (method === "PATCH") {
        const a = appeals.find((x) => x.id === num(2));
        if (!a) throw new DemoError("Topilmadi.", 404);
        a.status = body.status === "rejected" ? "rejected" : "resolved";
        return a;
      }
      return appeals.map((a) => ({ ...a, student_name: userById(a.student).fullname, course_title: courseTitle(a.course), assignment_title: assignments.find((x) => x.id === a.assignment)?.title }));
    }
    if (what === "absence-requests") {
      if (method === "PATCH") {
        const a = absenceRequests.find((x) => x.id === num(2));
        if (!a) throw new DemoError("Topilmadi.", 404);
        a.status = body.status === "rejected" ? "rejected" : "approved";
        return a;
      }
      return absenceRequests.map((a) => ({ ...a, student_name: userById(a.student).fullname, course_title: courseTitle(a.course) }));
    }
    if (what === "question-banks") {
      if (method === "POST") {
        const b: Row = { id: questionBanks.length + 1, course: Number(body.course) || 1, title: String(body.title || "Yangi bank"), questions: 0, updated_at: iso(Date.now()) };
        questionBanks.unshift(b);
        return b;
      }
      return questionBanks.map((b) => ({ ...b, course_title: courseTitle(b.course) }));
    }
    if (what === "grant-interviews") return grantInterviews;
    if (what === "messages") {
      if (method === "POST") {
        const m: Row = { id: sentMessages.length + 1, group: String(body.group || "IT102-26"), subject: String(body.subject || ""), text: String(body.text || ""), created_at: iso(Date.now()) };
        sentMessages.unshift(m);
        return m;
      }
      return sentMessages;
    }
  }

  // Modullar, testlar, imtihonlar (demo)
  if (at("courses", "#", "modules")) {
    const cid = num(1);
    const bk = books.filter((b) => b.course === cid);
    const as = assignments.filter((a) => a.course === cid);
    return modules.filter((m) => m.course === cid).map((m, i, arr) => ({
      ...m,
      materials: bk.filter((_, k) => moduleFor(cid, k) === m.id || (i === arr.length - 1 && k >= arr.length)).map(bookOut),
      assignments: as.filter((_, k) => moduleFor(cid, k + 1) === m.id).map((a) => asgOut(a, user)),
      quizzes: quizzes.filter((z) => z.module === m.id).map((z) => quizOut(z, user)),
    }));
  }
  if (seg[0] === "quizzes") {
    const visible = (z: Row) => user.role !== "student" || courseById(z.course)?.studentIds.includes(user.id);
    if (seg.length === 1 && method === "GET") return quizzes.filter(visible).map((z) => quizOut(z, user));
    if (seg.length === 1 && method === "POST") {
      needTeacher(user);
      const qs = Array.isArray(body.questions) ? body.questions : [];
      if (!qs.length) throw new DemoError("questions: Kamida bitta savol qo‘shing.", 400);
      const z: Row = {
        id: Math.max(0, ...quizzes.map((x) => x.id)) + 1, course: Number(body.course), module: body.module ? Number(body.module) : moduleFor(Number(body.course), 0),
        title: String(body.title || "Test"), time_limit_min: Math.max(1, Number(body.time_limit_min) || 10), max_attempts: Math.max(1, Number(body.max_attempts) || 1),
        deadline: String(body.deadline), created_at: iso(Date.now()),
        questions: qs.map((x: Row) => ({ text: String(x.text), options: (x.options as string[]).map(String), correct: Number(x.correct) })),
      };
      quizzes.push(z);
      const nid = Math.max(0, ...notifications.map((x) => x.id)) + 1;
      courseById(z.course)?.studentIds.forEach((sid: number, k: number) => notifications.push({ id: nid + k, user: sid, type: "assignment", title: "Yangi test", message: `${z.title} · ${courseTitle(z.course)}`, link: `/quizzes/${z.id}`, is_read: false, created_at: iso(Date.now()) }));
      return quizOut(z, user);
    }
    const z = quizzes.find((x) => x.id === num(1));
    if (!z || !visible(z)) throw new DemoError("Test topilmadi.", 404);
    if (seg.length === 2 && method === "DELETE") {
      needTeacher(user);
      quizzes.splice(quizzes.indexOf(z), 1);
      return null;
    }
    if (seg.length === 2) {
      const out: Row = { ...quizOut(z, user), questions: z.questions.map((x: Row, k: number) => ({ id: k, text: x.text, options: x.options, ...(isTeacher(user) ? { correct: x.correct } : {}) })) };
      out.my_attempts = quizAttempts.filter((a) => a.quiz === z.id && a.student === user.id).map((a) => omit(a, ["answers"]));
      return out;
    }
    if (seg[2] === "submit" && method === "POST") {
      if (user.role !== "student") throw new DemoError("Testni faqat talaba topshiradi.", 403);
      const used = quizAttempts.filter((a) => a.quiz === z.id && a.student === user.id).length;
      if (used >= z.max_attempts) throw new DemoError("Urinishlar tugagan.", 400);
      if (Date.now() > new Date(z.deadline).getTime()) throw new DemoError("Test muddati tugagan.", 400);
      const answers: number[] = Array.isArray(body.answers) ? body.answers.map(Number) : [];
      const review = z.questions.map((x: Row, k: number) => ({ id: k, correct: x.correct, chosen: answers[k] ?? null, ok: answers[k] === x.correct }));
      const correct = review.filter((r: Row) => r.ok).length;
      const a: Row = { id: quizAttempts.length + 1, quiz: z.id, student: user.id, correct, total: z.questions.length, score: Math.round((correct / z.questions.length) * 100), answers, finished_at: iso(Date.now()) };
      quizAttempts.push(a);
      return { ...omit(a, ["answers"]), review };
    }
    if (seg[2] === "results") {
      needTeacher(user);
      return (courseById(z.course)?.studentIds ?? []).map((sid: number) => {
        const mine = quizAttempts.filter((a) => a.quiz === z.id && a.student === sid);
        return { student: sid, student_name: userById(sid).fullname, attempts: mine.length, best_score: mine.length ? Math.max(...mine.map((a) => a.score)) : null, last_at: mine.length ? mine[mine.length - 1].finished_at : null };
      });
    }
  }
  if (at("exams")) {
    const mine = user.role === "student" ? exams.filter((e) => courseById(e.course)?.studentIds.includes(user.id)) : exams;
    return mine.map((e) => ({ ...e, course_title: courseTitle(e.course), course_code: courseById(e.course)?.code }));
  }

  // Admin: fakultetlar, guruhlar, murojaatlarni ko‘rib chiqish (demo)
  if (at("admin", "faculties")) { needAdmin(user); return faculties; }
  if (seg[0] === "admin" && seg[1] === "groups") {
    needAdmin(user);
    if (seg.length === 2 && method === "POST") {
      const code = String(body.code || "").trim().toUpperCase();
      if (!code) throw new DemoError("code: Guruh kodini kiriting.", 400);
      if (groups.some((g) => g.code === code)) throw new DemoError("code: Bu guruh mavjud.", 400);
      const g: Row = { id: Math.max(0, ...groups.map((x) => x.id)) + 1, code, faculty: Number(body.faculty) || 1, year: Number(body.year) || 1, language: String(body.language || "O‘zbek"), curator: body.curator ? Number(body.curator) : null };
      groups.push(g);
      return groupOut(g);
    }
    if (seg.length === 3 && method === "PATCH") {
      const g = groups.find((x) => x.id === num(2));
      if (!g) throw new DemoError("Topilmadi.", 404);
      for (const k of ["faculty", "year", "language"]) if (k in body) g[k] = body[k];
      if ("curator" in body) g.curator = body.curator ? Number(body.curator) : null;
      return groupOut(g);
    }
    if (seg.length === 3 && method === "DELETE") {
      const g = groups.find((x) => x.id === num(2));
      if (g && groupOut(g).student_count) throw new DemoError("Guruhda talabalar bor — avval ularni boshqa guruhga o‘tkazing.", 400);
      if (g) groups.splice(groups.indexOf(g), 1);
      return null;
    }
    return groups.map(groupOut);
  }
  if (seg[0] === "requests" && seg.length === 2 && method === "PATCH") {
    needAdmin(user);
    const r = requestRows.find((x) => x.id === num(1));
    if (!r) throw new DemoError("Topilmadi.", 404);
    if (["new", "processing", "ready", "rejected"].includes(String(body.status))) r.status = body.status;
    if ("answer" in body) r.answer = String(body.answer);
    r.updated_at = iso(Date.now());
    notifications.push({ id: Math.max(0, ...notifications.map((x) => x.id)) + 1, user: r.user, type: "system", title: "Murojaat holati o‘zgardi", message: `${r.subject || r.type}: ${r.status === "ready" ? "tayyor" : r.status === "rejected" ? "rad etildi" : "ko‘rib chiqilmoqda"}`, link: "/requests", is_read: false, created_at: iso(Date.now()) });
    return r;
  }

  // Demo-only bo‘limlar
  if (at("finance")) return finance;
  if (seg[0] === "requests") {
    if (method === "POST") {
      const r: Row = { id: requestRows.length + 1, kind: String(body.kind || "Ma’lumotnoma"), document: String(body.document || ""), phone: String(body.phone || ""), files: Array.isArray(body.files) ? body.files : [], type: String(body.document || body.type || "Boshqa"), language: String(body.language || "O‘zbek"), purpose: String(body.purpose || ""), subject: String(body.subject || ""), description: String(body.description || ""), status: "new", created_at: iso(Date.now()), updated_at: iso(Date.now()), user: user.id };
      requestRows.unshift(r);
      return r;
    }
    return requestRows.filter((r) => r.user === user.id || user.role !== "student").map((r) => ({ ...r, student_name: userById(r.user)?.fullname, group_code: userById(r.user)?.group_code }));
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
        file: body.file instanceof File ? `/media/assignments/${body.file.name}` : null, deadline: String(body.deadline), teacher: user.id,
        max_attempts: Math.max(1, Number(body.max_attempts) || 3), allow_late: body.allow_late === true || body.allow_late === "true" || body.allow_late === "on",
        created_at: iso(Date.now()), updated_at: iso(Date.now()),
      };
      if (!a.course || !courseById(a.course)) throw new DemoError("course: Kursni tanlang.", 400);
      if (Number.isNaN(new Date(a.deadline).getTime())) throw new DemoError("deadline: Muddatni kiriting.", 400);
      assignments.push(a);
      events.push({
        id: Math.max(0, ...events.map((x) => x.id)) + 1, course: a.course, title: `Dedlayn: ${a.title}`, description: "", event_type: "assignment_deadline",
        start_time: a.deadline, end_time: iso(new Date(a.deadline).getTime() + 30 * MIN), room: "", period: null, for_group: "All", created_by: user.id, created_at: a.created_at,
      });
      const nid = Math.max(0, ...notifications.map((x) => x.id)) + 1;
      courseById(a.course)!.studentIds.forEach((sid: number, k: number) =>
        notifications.push({ id: nid + k, user: sid, type: "assignment", title: "Yangi topshiriq", message: `${a.title} · ${courseTitle(a.course)}`, link: `/assignments/${a.id}`, is_read: false, created_at: iso(Date.now()) }),
      );
      return asgOut(a, user);
    }
    const a = assignments.find((x) => x.id === num(1));
    if (!a) throw new DemoError("Topilmadi.", 404);
    if (seg.length === 2) {
      if (method === "PATCH") {
        needTeacher(user);
        for (const k of ["title", "description", "deadline"]) if (k in body) a[k] = body[k];
        if ("max_attempts" in body) a.max_attempts = Math.max(1, Number(body.max_attempts) || 1);
        if ("allow_late" in body) a.allow_late = body.allow_late === true || body.allow_late === "true" || body.allow_late === "on";
        a.updated_at = iso(Date.now());
        const ev = events.find((e) => e.event_type === "assignment_deadline" && e.course === a.course && e.title.endsWith(a.title));
        if (ev && "deadline" in body) { ev.start_time = a.deadline; ev.end_time = iso(new Date(a.deadline).getTime() + 30 * MIN); }
      }
      if (method === "DELETE") {
        needTeacher(user);
        assignments.splice(assignments.indexOf(a), 1);
        for (let i = events.length - 1; i >= 0; i--) if (events[i].event_type === "assignment_deadline" && events[i].course === a.course && events[i].title === `Dedlayn: ${a.title}`) events.splice(i, 1);
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
        period: body.period ? Number(body.period) : null, lesson_type: body.lesson_type ?? "lecture", for_group: body.for_group ?? null, created_by: user.id, created_at: iso(Date.now()),
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
          automated_checkin: true, attendance_minutes: Math.max(60, Math.round((new Date(ev.end_time).getTime() - new Date(ev.start_time).getTime()) / MIN)), late_after_minutes: 10, location_latitude: body.latitude ?? null, location_longitude: body.longitude ?? null,
          location_radius_m: 80, max_location_accuracy_m: 100, ended_at: null,
        };
        sessions.push(session);
      }
    }
    return { event: eventOut(ev), session: session ? sessionOut(session) : null };
  }
  if (seg[0] === "attendance") {
    if (at("attendance", "my")) return records.filter((r) => r.student === user.id).sort((a, b) => +new Date(sessions.find((s) => s.id === b.session)!.starts_at) - +new Date(sessions.find((s) => s.id === a.session)!.starts_at)).map(recordOut);
    if (at("attendance", "active")) {
      return sessions
        .filter((x) => !x.ended_at && courseById(x.course)?.studentIds.includes(user.id) && Date.now() < new Date(x.starts_at).getTime() + x.attendance_minutes * MIN)
        .map((x) => ({ ...sessionOut(x), course_code: courseById(x.course)?.code, already_checked_in: records.some((r) => r.session === x.id && r.student === user.id) }));
    }
    if (at("attendance", "check-in")) {
      const x = sessions.find((y) => y.id === Number(body.session));
      if (!x) throw new DemoError("Davomat sessiyasi topilmadi.", 404);
      const late = Date.now() > new Date(x.starts_at).getTime() + x.late_after_minutes * MIN;
      const data = { status: late ? "late" : "present", note: "", source: String(body.channel ?? "manual_code"), checked_at: iso(Date.now()), last_seen_at: iso(Date.now()), presence_samples: 1 };
      const r = records.find((y) => y.session === x.id && y.student === user.id);
      if (r) Object.assign(r, data);
      else records.push({ id: recordId++, session: x.id, student: user.id, distance_m: null, location_accuracy_m: null, ...data });
      return { status: data.status, manual_override: false };
    }
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
        manual_code: "12345678", qr_proof: `demo-qr-${s.id}-${Math.floor(Date.now() / 15000)}`,
        ultrasound_code: ((s.id * 2654435761 + Math.floor(Date.now() / 15000) * 40503) >>> 0).toString(16).padStart(8, "0"), refresh_seconds: 15, starts_at: s.starts_at, late_after_at: iso(start + s.late_after_minutes * MIN),
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
