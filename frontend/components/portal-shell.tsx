"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  CalendarDays,
  UserRound,
  LogOut,
  ArrowUpRight,
  Menu,
  GraduationCap,
  Settings2,
  Bell,
  ShieldCheck,
  ScanLine,
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
    href: "/my-courses",
    label: "Darslarim",
    icon: GraduationCap,
    id: "materials",
  },
  {
    href: "/assignments",
    label: "Topshiriqlar",
    icon: ClipboardList,
    id: "assignments",
  },
  {
    href: "/calendar",
    label: "Taqvim",
    icon: CalendarDays,
    id: "schedule",
  },
  {
    href: "/profile",
    label: "Profil",
    icon: UserRound,
    id: "profile",
  },
];
const demoSectionLinks = new Set([
  "/dashboard",
  "/my-courses",
  "/assignments",
  "/calendar",
  "/attendance",
]);
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
  const admin = user?.role === "admin";
  const teacher = user?.role === "ustoz" || admin;
  const menuLinks = [
    ...links.slice(0, 4),
    ...(!teacher
      ? [{ href: "/attendance", label: "Davomat", icon: ScanLine, id: "attendance" }]
      : []),
    ...links.slice(4),
    ...(teacher
      ? [
          {
            href: "/manage",
            label: admin ? "Ta’lim boshqaruvi" : "Ustoz boshqaruvi",
            icon: Settings2,
            id: "overview",
          },
          ...(admin
            ? [
                {
                  href: "/admin-panel",
                  label: "Admin boshqaruvi",
                  icon: ShieldCheck,
                  id: "overview",
                },
              ]
            : []),
        ]
      : []),
  ];
  const demo = path === "/preview",
    title =
      menuLinks.find((l) => path.startsWith(l.href))?.label || "Bosh sahifa";
  const nav = (
    <>
      <Brand />
      <div className="sidebar-caption">
        {admin ? "ADMIN KABINETI" : teacher ? "USTOZ KABINETI" : "TALABA KABINETI"}
      </div>
      <nav aria-label="Asosiy menyu" className="mu-nav">
        {menuLinks.map(({ href, label, icon: Icon, id }) => {
          const isActive =
            path === href ||
            path.startsWith(`${href}/`) ||
            (demo && href === "/dashboard");

          return (
            <Link
              key={href}
              href={
                demo && demoSectionLinks.has(href) ? `/preview#${id}` : href
              }
              className={isActive ? "active" : ""}
              aria-current={isActive ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {href === "/dashboard" && <span className="nav-dot" />}
            </Link>
          );
        })}
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
    <div className={`portal ${teacher ? "teacher-portal" : "student-portal"}`}>
      {!demo && <AttendancePermissionSetup />}
      <a className="skip-link" href="#main-content">
        Asosiy qismga o‘tish
      </a>
      <aside className="mu-sidebar">{nav}</aside>
      <div className="portal-body">
        <header className="portal-header">
          <div className="header-context">
            {!teacher && (
              <Link
                href={demo ? "/preview#overview" : "/dashboard"}
                className="mobile-lms-title"
              >
                MU LMS
              </Link>
            )}
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
              {admin ? "Admin portali" : teacher ? "Ustoz portali" : "Talaba portali"} <span>/</span>{" "}
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
                  : admin
                    ? "Administrator"
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
        {!teacher && (
          <nav className="mobile-bottom-nav" aria-label="Mobil asosiy menyu">
            <Link
              href={demo ? "/preview#overview" : "/dashboard"}
              className={demo || path === "/dashboard" ? "active" : ""}
            >
              <LayoutDashboard />
              <span>Bosh sahifa</span>
            </Link>
            <Link
              href={demo ? "/preview#materials" : "/my-courses"}
              className={
                path.startsWith("/my-courses") ||
                path.startsWith("/courses") ||
                path.startsWith("/lessons")
                  ? "active"
                  : ""
              }
            >
              <GraduationCap />
              <span>Darslar</span>
            </Link>
            <Link
              href={demo ? "/preview#assignments" : "/assignments"}
              className={path.startsWith("/assignments") ? "active" : ""}
            >
              <ClipboardList />
              <span>Topshiriqlar</span>
            </Link>
            <Link
              href="/attendance"
              className={path.startsWith("/attendance") ? "active" : ""}
            >
              <ScanLine />
              <span>Skaner</span>
            </Link>
            <Link
              href="/notifications"
              className={path.startsWith("/notifications") ? "active" : ""}
            >
              <Bell />
              <span>Xabarlar</span>
            </Link>
            <Link
              href="/profile"
              className={path.startsWith("/profile") ? "active" : ""}
            >
              <UserRound />
              <span>Profil</span>
            </Link>
          </nav>
        )}
        <footer className="portal-footer">
          <span>Millat Umidi uchun LMS konsepti</span>
          <span>Ta’lim. Rivojlanish. Natija.</span>
        </footer>
      </div>
    </div>
  );
}
