"use client";

import { useState } from "react";
import { CalendarHeart, Check, MapPin, Users } from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { getCampusEvents, toggleCampusEvent } from "@/lib/api-service";
import { Empty, ErrorNote, Page, PageHeader, PageSkeleton, Pill, Progress, useLoad } from "@/components/mu/kit";
import { MONTHS_SHORT, fmtTime, tz } from "@/lib/format";

export default function EventsPage() {
  const { data, loading, error, reload } = useLoad(() => getCampusEvents());
  const [override, setOverride] = useState<any[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const rows = (override ?? data ?? []) as any[];

  async function toggle(id: number) {
    setBusy(id);
    try {
      setOverride(await toggleCampusEvent(id));
    } catch {
      reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <ProtectedRoute>
      <Page>
        <PageHeader eyebrow="Universitet hayoti" title="Tadbirlar" description="Kampusdagi yaqin tadbirlarga ro‘yxatdan o‘ting." />
        {error ? (
          <ErrorNote message="Tadbirlar bo‘limi hozircha faqat demo rejimda mavjud." onRetry={reload} />
        ) : loading ? (
          <PageSkeleton rows={2} />
        ) : rows.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {rows.map((e) => {
              const p = tz(e.starts_at);
              return (
                <article key={e.id} className="flex gap-4 rounded-2xl border bg-white p-5 shadow-card">
                  <div className="grid h-16 w-14 shrink-0 place-items-center rounded-2xl bg-navy-700 text-center text-white">
                    <div>
                      <p className="font-heading text-xl font-semibold leading-none">{p.d}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-wider text-gold-400">{MONTHS_SHORT[p.m - 1]}</p>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <Pill tone="gold">{e.category}</Pill>
                    <h3 className="mt-2 text-[15px] font-semibold leading-snug text-navy-900">{e.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{e.description}</p>
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><MapPin size={13} /> {e.location} · {fmtTime(e.starts_at)}</p>
                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Users size={12} /> {e.registered} / {e.seats}</span>
                      </div>
                      <Progress value={(e.registered / e.seats) * 100} thin tone="gold" />
                    </div>
                    <button
                      onClick={() => toggle(e.id)}
                      disabled={busy === e.id}
                      className={`mt-4 inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:opacity-60 ${e.is_registered ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200" : "bg-navy-700 text-white hover:bg-navy-800"}`}
                    >
                      {e.is_registered ? <><Check size={16} /> Ro‘yxatdan o‘tilgan</> : "Ro‘yxatdan o‘tish"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <Empty icon={CalendarHeart} title="Yaqin tadbirlar yo‘q" />
        )}
      </Page>
    </ProtectedRoute>
  );
}
