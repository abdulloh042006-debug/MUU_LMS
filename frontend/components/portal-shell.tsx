"use client";

import { useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Award,
  BookOpen,
  CalendarDays,
  CalendarHeart,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  ScanLine,
  Settings2,
  ShieldCheck,
  UserRound,
  UserCheck,
  Wallet,
  Bell,
  MessageSquareText,
  X,
  ArrowUpRight,
  AlertTriangle,
  CalendarClock,
  ClipboardCheck,
  Clock3,
  FileHeart,
  FileText,
  HelpCircle,
  ListTodo,
  ListChecks,
  Mic,
  Scale,
  Send,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { NotificationBell } from "@/components/notification-bell";
import { AttendancePermissionSetup } from "@/components/attendance-permission-setup";
import { Avatar } from "@/components/mu/kit";
import { DEMO_MODE } from "@/lib/demo-api";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: ElementType; keywords?: string };
type NavGroup = { title: string; items: NavItem[] };

const STUDENT_NAV: NavGroup[] = [
  {
    title: "Asosiy",
    items: [
      { href: "/dashboard", label: "Bosh sahifa", icon: LayoutDashboard, keywords: "home asosiy" },
      { href: "/calendar", label: "Dars jadvali", icon: CalendarDays, keywords: "taqvim schedule" },
      { href: "/my-courses", label: "Kurslarim", icon: GraduationCap, keywords: "fanlar darslar" },
      { href: "/assignments", label: "Topshiriqlar", icon: ClipboardList, keywords: "vazifa uy ishi" },
    ],
  },
  {
    title: "O‘qish",
    items: [
      { href: "/grades", label: "Baholar", icon: Award, keywords: "gpa natija" },
      { href: "/quizzes", label: "Testlar", icon: ListChecks, keywords: "quiz test" },
      { href: "/exams", label: "Imtihonlar", icon: GraduationCap, keywords: "nazorat exam" },
      { href: "/attendance", label: "Davomat", icon: ScanLine, keywords: "skaner qr" },
      { href: "/materials", label: "Materiallar", icon: BookOpen, keywords: "kitob adabiyot" },
    ],
  },
  {
    title: "Universitet",
    items: [
      { href: "/finance", label: "To‘lov va grant", icon: Wallet, keywords: "kontrakt moliya" },
      { href: "/requests", label: "Murojaatlar", icon: MessageSquareText, keywords: "spravka hujjat" },
      { href: "/events", label: "Tadbirlar", icon: CalendarHeart, keywords: "event" },
    ],
  },
];

const TEACHER_GROUPS: NavGroup[] = [
  {
    title: "O‘qitish",
    items: [
      { href: "/dashboard", label: "Bosh sahifa", icon: LayoutDashboard },
      { href: "/timetable", label: "Dars jadvali", icon: CalendarDays, keywords: "para timetable" },
      { href: "/my-courses", label: "Fanlar", icon: GraduationCap, keywords: "kurslar subjects" },
      { href: "/absence-requests", label: "Davomat so‘rovlari", icon: FileHeart, keywords: "sababli ariza" },
    ],
  },
  {
    title: "LMS",
    items: [
      { href: "/assignments", label: "Topshiriqlar", icon: ClipboardList, keywords: "vazifa dedlayn muddat" },
      { href: "/quizzes", label: "Testlar", icon: ListChecks, keywords: "quiz" },
      { href: "/review-queue", label: "Tekshirish navbati", icon: ClipboardCheck, keywords: "baholash review" },
      { href: "/manage", label: "Kurs boshqaruvi", icon: Settings2, keywords: "material topshiriq" },
      { href: "/question-banks", label: "Savollar banki", icon: HelpCircle, keywords: "test" },
      { href: "/deadlines", label: "Muddatlar taqvimi", icon: CalendarClock, keywords: "dedlayn" },
      { href: "/appeals", label: "Apellyatsiyalar", icon: Scale, keywords: "e’tiroz" },
    ],
  },
  {
    title: "Hisobotlar",
    items: [
      { href: "/reports/attendance", label: "Davomat", icon: UserCheck },
      { href: "/reports/grades", label: "Baholar", icon: Award },
      { href: "/reports/at-risk", label: "Xavf ostidagi talabalar", icon: AlertTriangle, keywords: "at-risk" },
    ],
  },
  {
    title: "Ish",
    items: [
      { href: "/tasks", label: "Vazifalar", icon: ListTodo },
      { href: "/policies", label: "Qoidalar", icon: FileText, keywords: "siyosat hujjat" },
      { href: "/grant-interviews", label: "Grant suhbatlari", icon: Mic },
      { href: "/timesheet", label: "Mening tabelim", icon: Clock3, keywords: "soat" },
    ],
  },
  {
    title: "Kampus",
    items: [{ href: "/messages", label: "Xabar yuborish", icon: Send, keywords: "e’lon" }],
  },
];

const TEACHER_NAV = TEACHER_GROUPS;

const ADMIN_NAV: NavGroup[] = [
  {
    title: "Boshqaruv",
    items: [
      { href: "/dashboard", label: "Bosh sahifa", icon: LayoutDashboard },
      { href: "/admin-panel", label: "Foydalanuvchilar", icon: ShieldCheck, keywords: "admin" },
    ],
  },
  ...TEACHER_GROUPS.filter((g) => g.title !== "O‘qitish"),
  { title: "Jadval", items: [{ href: "/timetable", label: "Dars jadvali", icon: CalendarDays }, { href: "/my-courses", label: "Fanlar", icon: GraduationCap }] },
];

const COMMON: NavItem[] = [
  { href: "/notifications", label: "Bildirishnomalar", icon: Bell },
  { href: "/profile", label: "Profil", icon: UserRound },
];

const BOTTOM_STUDENT: NavItem[] = [
  { href: "/dashboard", label: "Asosiy", icon: LayoutDashboard },
  { href: "/calendar", label: "Jadval", icon: CalendarDays },
  { href: "/attendance", label: "Skaner", icon: ScanLine },
  { href: "/assignments", label: "Vazifa", icon: ClipboardList },
];

const BOTTOM_STAFF: NavItem[] = [
  { href: "/dashboard", label: "Asosiy", icon: LayoutDashboard },
  { href: "/timetable", label: "Jadval", icon: CalendarDays },
  { href: "/review-queue", label: "Tekshiruv", icon: ClipboardCheck },
  { href: "/profile", label: "Profil", icon: UserRound },
];

export function Brand({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <img src="/brand/mu-logo.png" alt="Millat Umidi University" className="size-10 shrink-0 rounded-xl bg-white object-contain p-1" />
      {!compact && (
        <span className="leading-tight">
          <strong className={cn("block font-heading text-[15px] tracking-wide", light ? "text-white" : "text-navy-900")}>MILLAT UMIDI</strong>
          <small className={cn("block text-[10px] font-medium tracking-[0.18em]", light ? "text-gold-500" : "text-gold-600")}>
            LMS PORTAL
          </small>
        </span>
      )}
    </div>
  );
}

const isActive = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

export function PortalShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const admin = user?.role === "admin";
  const teacher = user?.role === "ustoz" || admin;
  const groups = admin ? ADMIN_NAV : teacher ? TEACHER_NAV : STUDENT_NAV;
  const all = useMemo(() => [...groups.flatMap((g) => g.items), ...COMMON], [groups]);
  const roleLabel = admin ? "Administrator" : teacher ? "O‘qituvchi" : "Talaba";

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [path]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (["/", "/login", "/register"].includes(path)) return <>{children}</>;

  const found = all.filter((item) => `${item.label} ${item.keywords ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  const current = all.find((item) => isActive(path, item.href));
  const bottom = teacher ? BOTTOM_STAFF : BOTTOM_STUDENT;

  const linkClass = (active: boolean) =>
    cn(
      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition",
      active ? "bg-white/12 text-white shadow-[inset_3px_0_0_#c5a55a]" : "text-navy-200 hover:bg-white/6 hover:text-white",
    );

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-4 pt-6">
        <Brand light />
      </div>
      <nav aria-label="Asosiy menyu" className="thin-scroll flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-400">{group.title}</p>
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = isActive(path, href);
                return (
                  <Link key={href} href={href} className={linkClass(active)} aria-current={active ? "page" : undefined} onClick={() => setMenuOpen(false)}>
                    <Icon size={18} className={active ? "text-gold-500" : "text-navy-300 group-hover:text-gold-500"} />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        <div>
          <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-400">Shaxsiy</p>
          <div className="space-y-0.5">
            {COMMON.map(({ href, label, icon: Icon }) => {
              const active = isActive(path, href);
              return (
                <Link key={href} href={href} className={linkClass(active)} aria-current={active ? "page" : undefined} onClick={() => setMenuOpen(false)}>
                  <Icon size={18} className={active ? "text-gold-500" : "text-navy-300 group-hover:text-gold-500"} />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
      <div className="space-y-2 border-t border-white/10 p-3">
        <a
          href="https://millatumidi.uz/"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between rounded-xl px-3 py-2 text-xs text-navy-300 hover:bg-white/6 hover:text-white"
        >
          Universitet sayti <ArrowUpRight size={14} />
        </a>
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-navy-200 hover:bg-white/6 hover:text-white"
        >
          <LogOut size={18} /> Chiqish
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {!DEMO_MODE && <AttendancePermissionSetup />}
      <a className="skip-link" href="#main-content">
        Asosiy qismga o‘tish
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] bg-gradient-to-b from-navy-800 to-navy-950 lg:block">{sidebar}</aside>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[290px] border-0 bg-gradient-to-b from-navy-800 to-navy-950 p-0 [&>button]:text-white">
          <SheetTitle className="sr-only">Navigatsiya</SheetTitle>
          {sidebar}
        </SheetContent>
      </Sheet>

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-20 border-b bg-white/85 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4 md:px-8">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="grid size-10 place-items-center rounded-xl border bg-white text-navy-700 lg:hidden"
              aria-label="Menyuni ochish"
            >
              <Menu size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="hidden text-[11px] font-medium uppercase tracking-[0.14em] text-gold-600 sm:block">{roleLabel} kabineti</p>
              <h2 className="truncate font-heading text-base font-semibold text-navy-900 sm:text-lg">{current?.label ?? "Millat Umidi"}</h2>
            </div>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden h-10 w-64 items-center gap-2 rounded-xl border bg-slate-50 px-3 text-sm text-slate-400 transition hover:bg-white md:flex"
            >
              <Search size={16} /> Qidirish…
              <kbd className="ml-auto rounded border bg-white px-1.5 text-[10px] text-slate-400">⌘K</kbd>
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="grid size-10 place-items-center rounded-xl border bg-white text-navy-600 md:hidden"
              aria-label="Qidirish"
            >
              <Search size={18} />
            </button>
            <NotificationBell />
            <Link href="/profile" className="hidden items-center gap-2.5 rounded-xl py-1 pl-1 pr-3 hover:bg-slate-50 sm:flex">
              <Avatar name={user?.fullname || "?"} size={36} />
              <span className="leading-tight">
                <strong className="block max-w-[140px] truncate text-[13px] text-navy-900">{user?.fullname || "Foydalanuvchi"}</strong>
                <small className="text-[11px] text-muted-foreground">{roleLabel}</small>
              </span>
            </Link>
          </div>
        </header>

        <div id="main-content" className="pb-28 lg:pb-12">
          {children}
        </div>
      </div>

      <nav
        aria-label="Mobil menyu"
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-2 pt-1.5">
          {bottom.slice(0, 2).map((item) => (
            <BottomLink key={item.href} item={item} active={isActive(path, item.href)} />
          ))}
          {teacher ? (
            <BottomLink item={bottom[2]} active={isActive(path, bottom[2].href)} />
          ) : (
            <Link
              href="/attendance"
              aria-label="Davomat skaneri"
              className="-mt-6 flex flex-col items-center gap-1 pb-1.5 text-[10px] font-semibold text-navy-700"
            >
              <span className="grid size-14 place-items-center rounded-full bg-gradient-to-br from-gold-500 to-gold-600 text-white shadow-lift ring-4 ring-white">
                <ScanLine size={24} />
              </span>
              Skaner
            </Link>
          )}
          <BottomLink item={bottom[3]} active={isActive(path, bottom[3].href)} />
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-medium text-slate-500"
          >
            <Menu size={20} /> Menyu
          </button>
        </div>
      </nav>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="top-[20%] max-w-md translate-y-0 gap-0 overflow-hidden rounded-2xl p-0 [&>button]:hidden">
          <DialogTitle className="sr-only">Sahifalarni qidirish</DialogTitle>
          <div className="flex items-center gap-2 border-b px-4">
            <Search size={16} className="text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Sahifa nomini yozing…"
              className="h-12 flex-1 bg-transparent text-sm outline-none"
              onKeyDown={(event) => {
                if (event.key === "Enter" && found[0]) {
                  router.push(found[0].href);
                  setQuery("");
                }
              }}
            />
            <button type="button" onClick={() => setSearchOpen(false)} aria-label="Yopish" className="text-slate-400">
              <X size={16} />
            </button>
          </div>
          <div className="thin-scroll max-h-72 overflow-y-auto p-2">
            {found.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted-foreground">Hech narsa topilmadi.</p>}
            {found.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => {
                  setQuery("");
                  setSearchOpen(false);
                }}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-navy-900 hover:bg-navy-50"
              >
                <Icon size={17} className="text-navy-500" /> {label}
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BottomLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-medium transition",
        active ? "text-navy-700" : "text-slate-500",
      )}
    >
      <span className={cn("grid h-7 w-12 place-items-center rounded-full transition", active && "bg-gold-100 text-navy-800")}>
        <Icon size={20} />
      </span>
      {item.label}
    </Link>
  );
}
