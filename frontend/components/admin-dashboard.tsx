"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  createAdminUser,
  getAdminStats,
  getAdminUsers,
  updateAdminUser,
} from "@/lib/api-service";
import { ProtectedRoute } from "@/components/protected-route";
import { Avatar, Empty, ErrorNote, Notice, Page, PageHeader, PageSkeleton, Panel, Pill, Stat } from "@/components/mu/kit";

type AdminUser = {
  id: number;
  fullname: string;
  username: string;
  role: "student" | "ustoz";
  email?: string;
  student_id?: string | null;
  phone_number?: string;
  is_active: boolean;
  must_change_password: boolean;
};

type AdminStats = {
  users_total: number;
  students_active: number;
  teachers_active: number;
  users_inactive: number;
  courses_active: number;
  courses_archived: number;
  assignments_total: number;
  submissions_pending: number;
  lessons_today: number;
  attendance_sessions_today: number;
};

const blankStats: AdminStats = {
  users_total: 0,
  students_active: 0,
  teachers_active: 0,
  users_inactive: 0,
  courses_active: 0,
  courses_archived: 0,
  assignments_total: 0,
  submissions_pending: 0,
  lessons_today: 0,
  attendance_sessions_today: 0,
};

export function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats>(blankStats);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"all" | "student" | "ustoz">("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | "create" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const [statsData, userRows] = await Promise.all([
      getAdminStats(),
      getAdminUsers(),
    ]);
    setStats(statsData);
    setUsers(Array.isArray(userRows) ? userRows : []);
  }, []);

  useEffect(() => {
    if (user?.role !== "admin") return;
    setLoading(true);
    load()
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [load, user?.role]);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return users.filter((item) => {
      if (role !== "all" && item.role !== role) return false;
      if (!normalized) return true;
      return [
        item.fullname,
        item.username,
        item.student_id || "",
        item.phone_number || "",
        item.email || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [query, role, users]);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy("create");
    setError("");
    setNotice("");

    try {
      await createAdminUser({
        fullname: String(data.get("fullname") || "").trim(),
        username: String(data.get("username") || "").trim(),
        role: String(data.get("role") || "student"),
        student_id: String(data.get("student_id") || "").trim() || null,
        phone_number: String(data.get("phone_number") || "").trim(),
        email: String(data.get("email") || "").trim(),
        password: String(data.get("password") || ""),
        is_active: true,
      });
      form.reset();
      await load();
      setNotice("Foydalanuvchi yaratildi. Birinchi kirishda parolni almashtiradi.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function toggleActive(item: AdminUser) {
    setBusy(item.id);
    setError("");
    setNotice("");
    try {
      await updateAdminUser(item.id, { is_active: !item.is_active });
      await load();
      setNotice(
        item.is_active
          ? `${item.fullname} hisobi vaqtincha o‘chirildi.`
          : `${item.fullname} hisobi faollashtirildi.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (user?.role !== "admin") {
    return (
      <ProtectedRoute>
        <Page>
          <Notice tone="amber">Bu bo‘lim faqat administrator uchun.</Notice>
        </Page>
      </ProtectedRoute>
    );
  }

  const field = "h-11 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-200";

  return (
    <ProtectedRoute>
      <Page>
        <PageHeader
          eyebrow="Administrator"
          title="Tizim boshqaruvi"
          description="Talaba, ustoz, darslar va LMS jarayonlarini bir joydan nazorat qiling."
          actions={
            <Link href="/manage" className="inline-flex h-10 items-center gap-2 rounded-xl bg-navy-700 px-4 text-sm font-semibold text-white hover:bg-navy-800">
              Ta’lim boshqaruvi <ChevronRight size={16} />
            </Link>
          }
        />
        {error && <div className="mb-4"><ErrorNote message={error} /></div>}
        {notice && (
          <p role="status" className="mb-4 flex items-center gap-2 rounded-2xl bg-emerald-50 p-3.5 text-sm text-emerald-800">
            <CheckCircle2 size={16} /> {notice}
          </p>
        )}

        {loading ? (
          <PageSkeleton />
        ) : (
          <div className="space-y-6">
            <section aria-label="Tizim ko‘rsatkichlari" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Stat label="Faol talabalar" value={stats.students_active} hint={`${stats.users_total} ta hisob`} icon={Users} tone="navy" />
              <Stat label="Ustozlar" value={stats.teachers_active} hint={`${stats.users_inactive} ta nofaol`} icon={ShieldCheck} tone="violet" />
              <Stat label="Faol kurslar" value={stats.courses_active} hint={`${stats.courses_archived} ta arxivda`} icon={BookOpen} tone="blue" />
              <Stat label="Tekshiruv kutmoqda" value={stats.submissions_pending} hint={`${stats.assignments_total} ta topshiriq`} icon={ClipboardCheck} tone="amber" />
              <Stat label="Bugungi darslar" value={stats.lessons_today} hint={`${stats.attendance_sessions_today} ta davomat`} icon={Activity} tone="green" className="col-span-2 lg:col-span-1" />
            </section>

            <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
              <Panel
                title="Foydalanuvchilar"
                description="Talaba va ustoz hisoblarini boshqaring."
                icon={Users}
                action={
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <label className="flex h-10 items-center gap-2 rounded-xl border px-3">
                      <Search size={15} className="text-slate-400" />
                      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ism, login yoki ID…" className="w-full min-w-[140px] bg-transparent text-sm outline-none" />
                    </label>
                    <select className="h-10 rounded-xl border bg-white px-3 text-sm" value={role} onChange={(e) => setRole(e.target.value as "all" | "student" | "ustoz")} aria-label="Rol bo‘yicha saralash">
                      <option value="all">Barcha</option>
                      <option value="student">Talabalar</option>
                      <option value="ustoz">Ustozlar</option>
                    </select>
                  </div>
                }
              >
                <ul className="thin-scroll max-h-[560px] divide-y overflow-y-auto">
                  {filteredUsers.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-3">
                      <Avatar name={item.fullname} size={38} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-navy-900">{item.fullname}</p>
                        <p className="truncate text-xs text-muted-foreground">@{item.username}{item.student_id ? ` · ${item.student_id}` : ""}</p>
                      </div>
                      <Pill tone={item.role === "student" ? "blue" : "violet"} className="hidden sm:inline-flex">{item.role === "student" ? "Talaba" : "Ustoz"}</Pill>
                      <Pill tone={item.is_active ? "green" : "red"} dot>{item.is_active ? "Faol" : "Nofaol"}</Pill>
                      <button
                        type="button"
                        disabled={busy === item.id}
                        onClick={() => void toggleActive(item)}
                        className="h-9 rounded-lg border px-3 text-xs font-semibold text-navy-700 hover:bg-navy-50 disabled:opacity-50"
                      >
                        {item.is_active ? "O‘chirish" : "Yoqish"}
                      </button>
                    </li>
                  ))}
                  {!filteredUsers.length && <li className="py-8"><Empty title="Foydalanuvchi topilmadi" /></li>}
                </ul>
              </Panel>

              <Panel title="Yangi foydalanuvchi" icon={UserPlus}>
                <form className="space-y-3.5" onSubmit={createUser}>
                  <input name="fullname" required maxLength={50} placeholder="Ism-familiya" aria-label="Ism-familiya" className={field} />
                  <input name="username" required maxLength={50} placeholder="Login" aria-label="Login" className={field} />
                  <select name="role" className={field} defaultValue="student" aria-label="Rol">
                    <option value="student">Talaba</option>
                    <option value="ustoz">Ustoz</option>
                  </select>
                  <input name="student_id" placeholder="Talaba ID (talaba uchun)" aria-label="Talaba ID" className={field} />
                  <input name="phone_number" placeholder="+998…" aria-label="Telefon" className={field} />
                  <input name="email" type="email" placeholder="Elektron pochta" aria-label="Email" className={field} />
                  <input name="password" type="password" minLength={8} autoComplete="new-password" required placeholder="Boshlang‘ich parol" aria-label="Boshlang‘ich parol" className={field} />
                  <p className="text-xs text-muted-foreground">Foydalanuvchi birinchi kirishda parolni almashtiradi.</p>
                  <button type="submit" disabled={busy === "create"} className="h-11 w-full rounded-xl bg-navy-700 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60">
                    {busy === "create" ? "Yaratilmoqda…" : "Hisob yaratish"}
                  </button>
                </form>
              </Panel>
            </div>
          </div>
        )}
      </Page>
    </ProtectedRoute>
  );
}
