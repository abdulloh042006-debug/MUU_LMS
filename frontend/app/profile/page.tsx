"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Award, BadgeCheck, Building2, GraduationCap, IdCard, KeyRound, LogOut, Mail, Pencil, Phone, ShieldCheck, UserCheck, Users } from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { useAuth } from "@/contexts/auth-context";
import { changePassword, getMyAttendance, getMyGrades, updateUserProfile } from "@/lib/api-service";
import { Avatar, IconChip, Notice, Page, Panel, Pill, Stat, settle, useLoad } from "@/components/mu/kit";
import { cn } from "@/lib/utils";

type Status = { kind: "success" | "error"; text: string } | null;
const input = "h-11 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-200 disabled:bg-slate-50";

function StatusLine({ s }: { s: Status }) {
  if (!s) return null;
  return (
    <p role="status" className={cn("rounded-xl px-3 py-2.5 text-xs", s.kind === "success" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800")}>
      {s.text}
    </p>
  );
}

function Info({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <IconChip icon={Icon} tone="navy" size={36} />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-navy-900">{value || "—"}</p>
      </div>
    </div>
  );
}

function Content() {
  const { user, reloadUser, logout } = useAuth();
  const mustChange = useSearchParams().get("change-password") === "1" || user?.must_change_password;
  const student = user?.role === "student";
  const role = user?.role === "admin" ? "Administrator" : user?.role === "ustoz" ? "O‘qituvchi" : "Talaba";

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [saving, setSaving] = useState(false);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [conf, setConf] = useState("");
  const [pStatus, setPStatus] = useState<Status>(null);
  const [pBusy, setPBusy] = useState(false);

  const { data } = useLoad(() => settle({ grades: student ? getMyGrades : async () => [], att: student ? getMyAttendance : async () => [] }), [student]);

  useEffect(() => {
    setName(user?.fullname || "");
    setEmail(user?.email || "");
    setBio(user?.bio || "");
  }, [user]);

  const gv = ((data?.grades ?? []) as any[]).map((g) => g.grade).filter((x) => typeof x === "number");
  const avg = gv.length ? Math.round(gv.reduce((s, x) => s + x, 0) / gv.length) : null;
  const att = (data?.att ?? []) as any[];
  const rate = att.length ? Math.round((att.filter((r) => r.status === "present" || r.status === "late").length / att.length) * 100) : null;

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      await updateUserProfile({ fullname: name.trim(), email: email.trim(), bio: bio.trim() });
      await reloadUser();
      setStatus({ kind: "success", text: "Profil saqlandi." });
      setEditing(false);
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setPStatus(null);
    if (next !== conf) return setPStatus({ kind: "error", text: "Yangi parollar bir xil emas." });
    setPBusy(true);
    try {
      await changePassword(cur, next, conf);
      await reloadUser();
      setCur("");
      setNext("");
      setConf("");
      setPStatus({ kind: "success", text: "Parol muvaffaqiyatli o‘zgartirildi." });
    } catch (err) {
      setPStatus({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setPBusy(false);
    }
  }

  return (
    <Page>
      {mustChange && <div className="mb-5"><Notice tone="amber">Xavfsizlik uchun davom etishdan oldin vaqtinchalik parolni almashtiring.</Notice></div>}

      {/* Profil kartasi */}
      <section className="overflow-hidden rounded-3xl border bg-white shadow-card">
        <div className="relative h-32 bg-gradient-to-r from-navy-700 via-navy-800 to-navy-950 md:h-40">
          <div className="absolute -right-10 -top-10 size-56 rounded-full bg-gold-500/20 blur-2xl" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gold-500/40" />
        </div>
        <div className="relative px-5 pb-6 md:px-8">
          <div className="-mt-12 flex flex-col gap-4 md:-mt-14 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-5">
              <Avatar name={user?.fullname} size={96} className="shrink-0 border-4 border-white shadow-lift md:!size-28" />
              <div className="md:pb-1">
                <h1 className="text-2xl font-semibold text-navy-900 md:text-3xl">{user?.fullname}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Pill tone="navy">{role}</Pill>
                  <Pill tone="green" dot>Faol</Pill>
                  {student && user?.group_code && <Pill tone="gold">{user.group_code}</Pill>}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(!editing)} className="inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold text-navy-700 hover:bg-navy-50">
                <Pencil size={15} /> Tahrirlash
              </button>
              <button onClick={logout} className="inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold text-rose-600 hover:bg-rose-50">
                <LogOut size={15} /> Chiqish
              </button>
            </div>
          </div>
          {user?.bio && <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600">{user.bio}</p>}
        </div>
      </section>

      {student && (
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="O‘rtacha ball" value={avg ?? "—"} icon={Award} tone="green" />
          <Stat label="Davomat" value={rate === null ? "—" : `${rate}%`} icon={UserCheck} tone="blue" />
          <Stat label="Kurs" value="1-kurs" icon={GraduationCap} tone="violet" />
          <Stat label="Holat" value="Faol" icon={BadgeCheck} tone="gold" />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Panel title="Ma’lumotlar" icon={IdCard}>
          <div className="divide-y">
            {student && <Info icon={IdCard} label="Talaba ID" value={user?.student_id} />}
            {student && <Info icon={Users} label="Guruh" value={user?.group_code} />}
            {student && <Info icon={Building2} label="Fakultet" value="Axborot texnologiyalari" />}
            <Info icon={Mail} label="Email" value={user?.email} />
            <Info icon={Phone} label="Telefon" value={user?.phone_number} />
            <Info icon={ShieldCheck} label="Telegram" value={user?.telegram_connected ? "Ulangan" : "Ulanmagan"} />
          </div>
        </Panel>

        <div className="space-y-6">
          {editing && (
            <Panel title="Profilni tahrirlash" icon={Pencil}>
              <form onSubmit={save} className="space-y-4">
                <StatusLine s={status} />
                <label className="block text-sm font-medium">To‘liq ism<input className={cn(input, "mt-1.5")} value={name} onChange={(e) => setName(e.target.value)} required /></label>
                <label className="block text-sm font-medium">Email<input type="email" className={cn(input, "mt-1.5")} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
                <label className="block text-sm font-medium">Qisqacha ma’lumot<textarea rows={3} className={cn(input, "mt-1.5 h-auto py-2.5")} value={bio} onChange={(e) => setBio(e.target.value)} /></label>
                <button disabled={saving} className="h-11 rounded-xl bg-navy-700 px-6 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60">{saving ? "Saqlanmoqda…" : "Saqlash"}</button>
              </form>
            </Panel>
          )}
          {!editing && status?.kind === "success" && <StatusLine s={status} />}

          <Panel title="Xavfsizlik" description="Parolni vaqti-vaqti bilan yangilab turing." icon={KeyRound}>
            <form onSubmit={savePassword} className="space-y-4">
              <StatusLine s={pStatus} />
              <label className="block text-sm font-medium">Joriy parol<input type="password" autoComplete="current-password" className={cn(input, "mt-1.5")} value={cur} onChange={(e) => setCur(e.target.value)} required /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium">Yangi parol<input type="password" autoComplete="new-password" className={cn(input, "mt-1.5")} value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} /></label>
                <label className="block text-sm font-medium">Takrorlang<input type="password" autoComplete="new-password" className={cn(input, "mt-1.5")} value={conf} onChange={(e) => setConf(e.target.value)} required minLength={8} /></label>
              </div>
              <button disabled={pBusy} className="h-11 rounded-xl border border-navy-700 px-6 text-sm font-semibold text-navy-700 hover:bg-navy-50 disabled:opacity-60">{pBusy ? "Saqlanmoqda…" : "Parolni yangilash"}</button>
            </form>
          </Panel>
        </div>
      </div>
    </Page>
  );
}

export default function Profile() {
  return (
    <ProtectedRoute>
      <Suspense fallback={null}>
        <Content />
      </Suspense>
    </ProtectedRoute>
  );
}
