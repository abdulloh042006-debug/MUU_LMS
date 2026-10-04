"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  ChartNoAxesCombined,
  CalendarDays,
  UserRound,
  LogOut,
  ArrowUpRight,
  Menu,
  GraduationCap,
  Settings2,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notification-bell";
import { AttendancePermissionSetup } from "@/components/attendance-permission-setup";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
const links = [
  {
    href: "/dashboard",
    label: "Bosh sahifa",
    icon: LayoutDashboard,
    id: "overview",
  },
  {
    href: "/courses",
    label: "O‘quv materiallari",
    icon: BookOpen,
    id: "materials",
  },
  {
    href: "/assignments",
    label: "Topshiriqlar",
    icon: ClipboardList,
    id: "assignments",
  },
  {
    href: "/grades",
    label: "Baholarim",
    icon: ChartNoAxesCombined,
    id: "results",
  },
  { href: "/calendar", label: "Taqvim", icon: CalendarDays, id: "schedule" },
  {
    href: "/profile",
    label: "Mening profilim",
    icon: UserRound,
    id: "overview",
  },
];
export function Brand() {
  return (
    <div className="mu-brand">
      <img src="/brand/mu-logo.png" alt="Millat Umidi University" />
      <span>
        <strong>MILLAT UMIDI</strong>
        <small>LEARNING MANAGEMENT SYSTEM</small>
      </span>
    </div>
  );
}
export function PortalShell({ children }: { children: ReactNode }) {
  const path = usePathname(),
    { user, logout } = useAuth(),
    [open, setOpen] = useState(false);
  if (["/", "/login", "/register"].includes(path)) return <>{children}</>;
  const teacher = user?.role === "ustoz" || user?.role === "admin";
  const menuLinks = [
    ...links.slice(0, 1),
    {
      href: "/my-courses",
      label: "Mening kurslarim",
      icon: GraduationCap,
      id: "materials",
    },
    ...links.slice(1).filter((l) => !teacher || l.href !== "/grades"),
    ...(teacher
      ? [
          {
            href: "/manage",
            label: "Ustoz boshqaruvi",
            icon: Settings2,
            id: "overview",
          },
        ]
      : [
          {
            href: "/attendance",
            label: "Davomatim",
            icon: UserCheck,
            id: "schedule",
          },
        ]),
  ];
  const demo = path === "/preview",
    title =
      menuLinks.find((l) => path.startsWith(l.href))?.label || "Bosh sahifa";
  const nav = (
    <>
      <Brand />
      <div className="sidebar-caption">
        {teacher ? "USTOZ KABINETI" : "TALABA KABINETI"}
      </div>
      <nav aria-label="Asosiy menyu" className="mu-nav">
        {(demo ? links : menuLinks).map(({ href, label, icon: Icon, id }) => (
          <Link
            key={href}
            href={demo ? `/preview#${id}` : href}
            className={
              path === href || (demo && href === "/dashboard") ? "active" : ""
            }
            aria-current={path === href ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            <Icon size={19} />
            <span>{label}</span>
            {href === "/dashboard" && <span className="nav-dot" />}
          </Link>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="education-mark">
          <GraduationCap size={29} />
          <p>
            Bilim bilan
            <br />
            <strong>kelajak sari.</strong>
          </p>
          <span>Millat Umidi University</span>
        </div>
        <a
          className="university-link"
          href="https://millatumidi.uz/"
          target="_blank"
          rel="noreferrer"
        >
          Universitet sayti <ArrowUpRight size={16} />
        </a>
        {demo ? (
          <Link className="signout" href="/login">
            <LogOut size={17} />
            Tizimga kirish
          </Link>
        ) : (
          <button className="signout" onClick={logout}>
            <LogOut size={17} />
            Chiqish
          </button>
        )}
      </div>
    </>
  );
  return (
    <div className="portal">
      {!demo && <AttendancePermissionSetup />}
      <a className="skip-link" href="#main-content">
        Asosiy qismga o‘tish
      </a>
      <aside className="mu-sidebar">{nav}</aside>
      <div className="portal-body">
        <header className="portal-header">
          <div className="header-context">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="mobile-menu"
                  aria-label="Menyuni ochish"
                >
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="mobile-sidebar">
                <SheetTitle className="sr-only">Navigatsiya</SheetTitle>
                {nav}
              </SheetContent>
            </Sheet>
            <span className="header-breadcrumb">
              {teacher ? "Ustoz portali" : "Talaba portali"} <span>/</span>{" "}
              <strong>{title}</strong>
            </span>
          </div>
          <div className="header-account">
            {!demo && <NotificationBell />}
            <span className="language-label">UZ</span>
            <span className="header-divider" />
            <div className="avatar">
              {(user?.fullname || "Talaba").slice(0, 1)}
            </div>
            <div>
              <strong>
                {demo ? "Namuna talaba" : user?.fullname || "Talaba"}
              </strong>
              <small>
                {demo
                  ? "Namoyish kabineti"
                  : user?.role === "ustoz"
                    ? "O‘qituvchi"
                    : "Shaxsiy kabinet"}
              </small>
            </div>
          </div>
        </header>
        {demo && (
          <div className="demo-notice">
            <span />
            Dizayn namoyishi · Quyidagi ma’lumotlar namunaviy.
            <Link href="/login">
              Haqiqiy kabinetga kirish <ArrowUpRight size={14} />
            </Link>
          </div>
        )}
        <div id="main-content" className="portal-surface">
          {children}
        </div>
        <footer className="portal-footer">
          <span>Millat Umidi uchun LMS konsepti</span>
          <span>Ta’lim. Rivojlanish. Natija.</span>
        </footer>
      </div>
    </div>
  );
}
