"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
} from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Inbox, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

/* ------------------------------------------------------------------ */
/* Ranglar                                                              */
/* ------------------------------------------------------------------ */

export type Tone = "neutral" | "navy" | "gold" | "green" | "amber" | "red" | "blue" | "violet";

export const TONE: Record<Tone, { pill: string; chip: string; bar: string; text: string }> = {
  neutral: { pill: "bg-slate-100 text-slate-600 ring-slate-200", chip: "bg-slate-100 text-slate-600", bar: "bg-slate-400", text: "text-slate-600" },
  navy: { pill: "bg-navy-50 text-navy-700 ring-navy-100", chip: "bg-navy-50 text-navy-700", bar: "bg-navy-700", text: "text-navy-700" },
  gold: { pill: "bg-gold-50 text-gold-800 ring-gold-200", chip: "bg-gold-100 text-gold-800", bar: "bg-gold-500", text: "text-gold-700" },
  green: { pill: "bg-emerald-50 text-emerald-700 ring-emerald-200", chip: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-500", text: "text-emerald-600" },
  amber: { pill: "bg-amber-50 text-amber-700 ring-amber-200", chip: "bg-amber-50 text-amber-700", bar: "bg-amber-500", text: "text-amber-600" },
  red: { pill: "bg-rose-50 text-rose-700 ring-rose-200", chip: "bg-rose-50 text-rose-700", bar: "bg-rose-500", text: "text-rose-600" },
  blue: { pill: "bg-sky-50 text-sky-700 ring-sky-200", chip: "bg-sky-50 text-sky-700", bar: "bg-sky-500", text: "text-sky-600" },
  violet: { pill: "bg-violet-50 text-violet-700 ring-violet-200", chip: "bg-violet-50 text-violet-700", bar: "bg-violet-500", text: "text-violet-600" },
};

/* ------------------------------------------------------------------ */
/* Sahifa tuzilmasi                                                     */
/* ------------------------------------------------------------------ */

export function Page({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <main
      className={cn(
        "mx-auto w-full px-4 pb-10 pt-5 md:px-8 md:pb-14 md:pt-8",
        wide ? "max-w-[1440px]" : "max-w-[1240px]",
        className,
      )}
    >
      {children}
    </main>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-700">{eyebrow}</p>}
        <h1 className="text-[26px] font-semibold leading-tight text-navy-900 md:text-[32px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-[15px]">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  flush,
  icon: Icon,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  flush?: boolean;
  icon?: ElementType;
}) {
  return (
    <section className={cn("rounded-2xl border bg-card shadow-card", className)}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 px-5 pb-1 pt-5">
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-navy-50 text-navy-700">
                <Icon size={18} />
              </span>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-[15px] font-semibold text-navy-900">{title}</h2>
              {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
            </div>
          </div>
          {action}
        </div>
      )}
      <div className={cn(flush ? "pt-3" : "p-5", title && !flush && "pt-3", bodyClassName)}>{children}</div>
    </section>
  );
}

export function SeeAll({ href, children = "Barchasi" }: { href: string; children?: ReactNode }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-navy-600 hover:bg-navy-50">
      {children} <ArrowUpRight size={14} />
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Kichik elementlar                                                    */
/* ------------------------------------------------------------------ */

export function Pill({ tone = "neutral", children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset", TONE[tone].pill, className)}>
      {dot && <span className={cn("size-1.5 rounded-full", TONE[tone].bar)} />}
      {children}
    </span>
  );
}

export function IconChip({ icon: Icon, tone = "navy", size = 40, className }: { icon: ElementType; tone?: Tone; size?: number; className?: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-xl", TONE[tone].chip, className)} style={{ width: size, height: size }}>
      <Icon size={Math.round(size * 0.47)} />
    </span>
  );
}

export function Avatar({ name, size = 36, className }: { name?: string; size?: number; className?: string }) {
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-navy-600 to-navy-900 font-semibold text-white", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function Progress({ value, tone = "navy", className, thin }: { value: number; tone?: Tone; className?: string; thin?: boolean }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className={cn("w-full overflow-hidden rounded-full bg-slate-100", thin ? "h-1.5" : "h-2", className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-[width] duration-700", TONE[tone].bar)} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Ring({
  value,
  size = 96,
  stroke = 9,
  color = "#1b2a4a",
  track = "#e8ebf3",
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}) {
  const v = Math.max(0, Math.min(100, value || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * v) / 100}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
  tone = "navy",
  href,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ElementType;
  tone?: Tone;
  href?: string;
  className?: string;
}) {
  const body = (
    <div className={cn("flex h-full items-start gap-3 rounded-2xl border bg-card p-4 shadow-card transition md:p-5", href && "hover:-translate-y-0.5 hover:shadow-lift", className)}>
      {icon && <IconChip icon={icon} tone={tone} />}
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 font-heading text-2xl font-semibold leading-none text-navy-900">{value}</p>
        {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Empty({ icon: Icon = Inbox, title, text, action }: { icon?: ElementType; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed bg-white/60 px-6 py-10 text-center">
      <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-navy-50 text-navy-500">
        <Icon size={22} />
      </span>
      <p className="text-sm font-semibold text-navy-900">{title}</p>
      {text && <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p>{message}</p>
        {onRetry && (
          <button onClick={onRetry} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold underline underline-offset-2">
            <RefreshCw size={13} /> Qayta urinish
          </button>
        )}
      </div>
    </div>
  );
}

export function Notice({ children, tone = "gold" }: { children: ReactNode; tone?: Tone }) {
  return <div className={cn("rounded-2xl px-4 py-3 text-xs leading-relaxed ring-1 ring-inset", TONE[tone].pill)}>{children}</div>;
}

export function Shimmer({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-slate-200/70", className)} />;
}

export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Yuklanmoqda">
      <Shimmer className="h-28 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Shimmer key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <Shimmer key={i} className="h-20 w-full rounded-2xl" />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Segmentli tanlov (tab)                                              */
/* ------------------------------------------------------------------ */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
  className?: string;
}) {
  return (
    <div className={cn("no-scrollbar -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0", className)}>
      <div role="tablist" className="inline-flex gap-1 rounded-2xl border bg-white p-1 shadow-card">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(o.value)}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-semibold transition",
                active ? "bg-navy-700 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-navy-700",
              )}
            >
              {o.label}
              {o.count !== undefined && (
                <span className={cn("rounded-full px-1.5 text-[10px]", active ? "bg-white/20" : "bg-slate-100")}>{o.count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ma'lumot yuklash                                                     */
/* ------------------------------------------------------------------ */

export function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<{ data: T | null; error: string; loading: boolean }>({ data: null, error: "", loading: true });
  const [tick, setTick] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    loaderRef
      .current()
      .then((data) => active && setState({ data, error: "", loading: false }))
      .catch((e) => active && setState({ data: null, error: e instanceof Error ? e.message : "Ma’lumotni yuklab bo‘lmadi.", loading: false }));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

/** Bir nechta so'rovni parallel yuklaydi; har biri alohida xato bo'lsa ham qolganlari ko'rsatiladi. */
export async function settle<T extends Record<string, () => Promise<any>>>(calls: T) {
  const entries = await Promise.all(
    Object.entries(calls).map(async ([key, fn]) => {
      try {
        return [key, await fn()] as const;
      } catch {
        return [key, null] as const;
      }
    }),
  );
  return Object.fromEntries(entries) as { [K in keyof T]: Awaited<ReturnType<T[K]>> | null };
}
