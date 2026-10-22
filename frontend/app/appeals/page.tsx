"use client";

import { useState } from "react";
import { Check, Scale, X } from "lucide-react";
import { StaffPage } from "@/components/mu/staff";
import { getAppeals, resolveAppeal } from "@/lib/api-service";
import { Avatar, Empty, ErrorNote, Page, PageHeader, PageSkeleton, Pill, Segmented, useLoad } from "@/components/mu/kit";
import { fmtDateTime } from "@/lib/format";

export default function Appeals() {
  const { data, loading, error, reload } = useLoad(() => getAppeals());
  const [tab, setTab] = useState<"pending" | "done">("pending");
  const [busy, setBusy] = useState<number | null>(null);
  const all = (data ?? []) as any[];
  const rows = all.filter((r) => (tab === "pending" ? r.status === "pending" : r.status !== "pending"));

  async function act(id: number, status: "resolved" | "rejected") {
    setBusy(id);
    try {
      await resolveAppeal(id, status);
      reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <StaffPage>
      <Page>
        <PageHeader eyebrow="LMS" title="Apellyatsiyalar" description="Talabalar baho bo‘yicha yuborgan e’tirozlar." />
        <Segmented className="mb-5" value={tab} onChange={setTab} options={[{ value: "pending", label: "Yangi", count: all.filter((r) => r.status === "pending").length }, { value: "done", label: "Ko‘rib chiqilgan" }]} />
        {error ? <ErrorNote message="Bu bo‘lim hozircha faqat demo rejimda mavjud." onRetry={reload} /> : loading ? <PageSkeleton rows={2} /> : rows.length ? (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.id} className="rounded-2xl border bg-white p-4 shadow-card md:p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <Avatar name={r.student_name} size={42} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-navy-900">{r.student_name}</p>
                    <p className="text-xs text-muted-foreground">{r.course_title} · {r.assignment_title} · {fmtDateTime(r.created_at)}</p>
                    <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{r.reason}</p>
                  </div>
                  <Pill tone="blue">Joriy baho: {r.old_grade}</Pill>
                </div>
                {r.status === "pending" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button disabled={busy === r.id} onClick={() => act(r.id, "resolved")} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-navy-700 px-4 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60"><Check size={16} /> Qayta ko‘rib chiqildi</button>
                    <button disabled={busy === r.id} onClick={() => act(r.id, "rejected")} className="inline-flex h-10 items-center gap-1.5 rounded-xl border px-4 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"><X size={16} /> Rad etish</button>
                  </div>
                ) : <div className="mt-3"><Pill tone={r.status === "resolved" ? "green" : "red"} dot>{r.status === "resolved" ? "Ko‘rib chiqildi" : "Rad etildi"}</Pill></div>}
              </li>
            ))}
          </ul>
        ) : <Empty icon={Scale} title="Apellyatsiya yo‘q" />}
      </Page>
    </StaffPage>
  );
}
