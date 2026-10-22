"use client";

import { useState } from "react";
import { Check, FileHeart, X } from "lucide-react";
import { StaffPage } from "@/components/mu/staff";
import { decideAbsence, getAbsenceRequests } from "@/lib/api-service";
import { Avatar, Empty, ErrorNote, Page, PageHeader, PageSkeleton, Pill, Segmented, useLoad, type Tone } from "@/components/mu/kit";
import { fmtDay } from "@/lib/format";

const ST: Record<string, [string, Tone]> = { pending: ["Kutilmoqda", "amber"], approved: ["Sababli deb belgilandi", "green"], rejected: ["Rad etildi", "red"] };

export default function AbsenceRequests() {
  const { data, loading, error, reload } = useLoad(() => getAbsenceRequests());
  const [tab, setTab] = useState<"pending" | "done">("pending");
  const [busy, setBusy] = useState<number | null>(null);
  const rows = ((data ?? []) as any[]).filter((r) => (tab === "pending" ? r.status === "pending" : r.status !== "pending"));

  async function decide(id: number, status: "approved" | "rejected") {
    setBusy(id);
    try {
      await decideAbsence(id, status);
      reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <StaffPage>
      <Page>
        <PageHeader eyebrow="Ta’lim" title="Davomat so‘rovlari" description="Talabalarning sababli kelmagan darslar bo‘yicha arizalari." />
        <Segmented className="mb-5" value={tab} onChange={setTab} options={[{ value: "pending", label: "Ko‘rib chiqilmagan", count: ((data ?? []) as any[]).filter((r) => r.status === "pending").length }, { value: "done", label: "Hal qilingan" }]} />
        {error ? <ErrorNote message="Bu bo‘lim hozircha faqat demo rejimda mavjud." onRetry={reload} /> : loading ? <PageSkeleton rows={2} /> : rows.length ? (
          <ul className="space-y-3">
            {rows.map((r) => {
              const [label, tone] = ST[r.status];
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-4 rounded-2xl border bg-white p-4 shadow-card">
                  <Avatar name={r.student_name} size={42} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-navy-900">{r.student_name}</p>
                    <p className="text-xs text-muted-foreground">{r.course_title} · {fmtDay(r.date)}</p>
                    <p className="mt-1.5 text-sm text-slate-700">{r.reason}</p>
                  </div>
                  {r.status === "pending" ? (
                    <div className="flex gap-2">
                      <button disabled={busy === r.id} onClick={() => decide(r.id, "approved")} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"><Check size={16} /> Qabul</button>
                      <button disabled={busy === r.id} onClick={() => decide(r.id, "rejected")} className="inline-flex h-10 items-center gap-1.5 rounded-xl border px-4 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"><X size={16} /> Rad</button>
                    </div>
                  ) : <Pill tone={tone} dot>{label}</Pill>}
                </li>
              );
            })}
          </ul>
        ) : <Empty icon={FileHeart} title="So‘rov yo‘q" />}
      </Page>
    </StaffPage>
  );
}
