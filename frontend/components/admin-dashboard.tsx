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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
        <Alert className="m-6">
          <AlertDescription>
            Bu bo‘lim faqat administrator uchun.
          </AlertDescription>
        </Alert>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <main className="workspace-page admin-dashboard">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">ADMINISTRATOR KABINETI</p>
            <h1>Tizim boshqaruvi</h1>
            <p>
              Talaba, ustoz, darslar va LMS jarayonlarini bir joydan nazorat
              qiling.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/manage">Ta’lim boshqaruvi</Link>
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-5">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {notice && (
          <p role="status" className="success-note">
            <CheckCircle2 size={16} />
            {notice}
          </p>
        )}

        {loading ? (
          <div className="notification-state">Yuklanmoqda…</div>
        ) : (
          <>
            <section className="admin-stat-grid" aria-label="Tizim ko‘rsatkichlari">
              <div className="admin-stat-card primary">
                <Users size={22} />
                <span>Faol talabalar</span>
                <strong>{stats.students_active}</strong>
                <small>{stats.users_total} ta boshqariladigan hisob</small>
              </div>
              <div className="admin-stat-card">
                <ShieldCheck size={22} />
                <span>Ustozlar</span>
                <strong>{stats.teachers_active}</strong>
                <small>{stats.users_inactive} ta nofaol hisob</small>
              </div>
              <div className="admin-stat-card">
                <BookOpen size={22} />
                <span>Faol darslar</span>
                <strong>{stats.courses_active}</strong>
                <small>{stats.courses_archived} ta arxivda</small>
              </div>
              <div className="admin-stat-card">
                <ClipboardCheck size={22} />
                <span>Tekshirish kutilmoqda</span>
                <strong>{stats.submissions_pending}</strong>
                <small>{stats.assignments_total} ta topshiriq</small>
              </div>
              <div className="admin-stat-card">
                <Activity size={22} />
                <span>Bugungi darslar</span>
                <strong>{stats.lessons_today}</strong>
                <small>{stats.attendance_sessions_today} ta davomat sessiyasi</small>
              </div>
            </section>

            <section className="admin-quick-grid">
              <Link href="/manage">
                <span>
                  <strong>Ta’lim boshqaruvi</strong>
                  <small>Dars, material, topshiriq, baho va davomat</small>
                </span>
                <ChevronRight size={18} />
              </Link>
              <Link href="/my-courses">
                <span>
                  <strong>Dars jadvali</strong>
                  <small>Barcha darslarning haftalik ko‘rinishi</small>
                </span>
                <ChevronRight size={18} />
              </Link>
            </section>

            <div className="admin-main-grid">
              <Card>
                <CardHeader>
                  <div className="admin-card-heading">
                    <div>
                      <CardTitle>Foydalanuvchilar</CardTitle>
                      <p>Talaba va ustoz hisoblarini boshqaring.</p>
                    </div>
                    <div className="admin-user-filters">
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Ism, login yoki ID..."
                          className="pl-9"
                        />
                      </div>
                      <select
                        className="native-select"
                        value={role}
                        onChange={(e) =>
                          setRole(e.target.value as "all" | "student" | "ustoz")
                        }
                        aria-label="Rol bo‘yicha saralash"
                      >
                        <option value="all">Barcha</option>
                        <option value="student">Talabalar</option>
                        <option value="ustoz">Ustozlar</option>
                      </select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="admin-user-list">
                  {filteredUsers.map((item) => (
                    <div className="admin-user-row" key={item.id}>
                      <div className="admin-user-avatar">
                        {item.fullname.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="admin-user-name">
                        <strong>{item.fullname}</strong>
                        <small>
                          @{item.username}
                          {item.student_id ? ` · ${item.student_id}` : ""}
                        </small>
                      </div>
                      <span className="admin-role-badge">
                        {item.role === "student" ? "Talaba" : "Ustoz"}
                      </span>
                      <span
                        className={`admin-account-state ${item.is_active ? "active" : "inactive"}`}
                      >
                        {item.is_active ? "Faol" : "Nofaol"}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant={item.is_active ? "outline" : "default"}
                        disabled={busy === item.id}
                        onClick={() => void toggleActive(item)}
                      >
                        {item.is_active ? "O‘chirish" : "Faollashtirish"}
                      </Button>
                    </div>
                  ))}
                  {!filteredUsers.length && (
                    <div className="empty-message small">
                      Foydalanuvchi topilmadi.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="admin-create-user">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <UserPlus size={20} />
                    <CardTitle>Yangi foydalanuvchi</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={createUser}>
                    <div className="space-y-2">
                      <Label htmlFor="admin-fullname">Ism-familiya</Label>
                      <Input id="admin-fullname" name="fullname" required maxLength={50} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin-username">Login</Label>
                      <Input id="admin-username" name="username" required maxLength={50} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin-role">Rol</Label>
                      <select id="admin-role" name="role" className="native-select" defaultValue="student">
                        <option value="student">Talaba</option>
                        <option value="ustoz">Ustoz</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin-student-id">Talaba ID</Label>
                      <Input id="admin-student-id" name="student_id" placeholder="Talaba uchun" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin-phone">Telefon</Label>
                      <Input id="admin-phone" name="phone_number" placeholder="+998..." />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin-email">Elektron pochta</Label>
                      <Input id="admin-email" name="email" type="email" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin-password">Boshlang‘ich parol</Label>
                      <Input
                        id="admin-password"
                        name="password"
                        type="password"
                        minLength={8}
                        autoComplete="new-password"
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Foydalanuvchi birinchi kirishda bu parolni almashtiradi.
                      </p>
                    </div>
                    <Button type="submit" className="w-full" disabled={busy === "create"}>
                      <UserPlus size={16} />
                      {busy === "create" ? "Yaratilmoqda…" : "Hisob yaratish"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </ProtectedRoute>
  );
}
