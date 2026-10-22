"use client";

import { useMemo, useState } from "react";
import { Check, Inbox, Loader, Paperclip, X } from "lucide-react";
import { AdminPage } from "@/components/mu/admin";
import { getRequests, updateRequest } from "@/lib/api-service";
import { Avatar, Empty, ErrorNote, Page, PageHeader, PageSkeleton, Pill, Segmented, useLoad, type Tone } from "@/components/mu/kit";
import { fmtDateTime } from "@/lib/format";

const ST: Record<string, [string, Tone]> = { new: ["Yangi", "blue"], processing: ["Ko‘rib chiqilmoqda", "amber"], ready: ["Tayyor", "green"], rejected: ["Rad etildi", "red"] };

export default function AdminRequests() {
  const { data, loading, error, reload } = useLoad(() => getRequests());
  const [tab, setTab] = useState<"new" | "processing" | "done">("new");
  const [busy, setBusy] = useState<number | null>(null);
  const all = useMemo(() => (data ?? []) as any[], [data]);
  const rows = all.filter((r) => (tab === "done" ? r.status === "ready" || r.status === "rejected" : r.status === tab));

  async function set(id: number, status: string) {
    setBusy(id);
    try {
      await updateRequest(id, { status });
      reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminPage>
      <Page>
        <PageHeader eyebrow="Administrator" title="Talabalar murojaatlari" description="Ma’lumotnoma va arizalarni ko‘rib chiqing — talabaga avtomatik bildirishnoma boradi." />
        <Segmented className="mb-5" value={tab} onChange={setTab} options={[
          { value: "new", label: "Yangi", count: all.filter((r) => r.status === "new").length },
          { value: "processing", label: "Jarayonda", count: all.filter((r) => r.status === "processing").length },
          { value: "done", label: "Yakunlangan" },
        ]} />
        {error ? <ErrorNote message="Bu bo‘lim hozircha faqat demo rejimda mavjud." onRetry={reload} /> : loading ? <PageSkeleton rows={2} /> : rows.length ? (
          <ul className="space-y-3">
            {rows.map((r) => {
              const [label, tone] = ST[r.status] ?? ["—", "neutral" as Tone];
              return (
                <li key={r.id} className="rounded-2xl border bg-white p-4 shadow-card md:p-5">
                  <div className="flex flex-wrap items-start gap-4">
                    <Avatar name={r.student_name} size={42} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-navy-900">{r.student_name} <span className="font-normal text-muted-foreground">· {r.group_code}</span></p>
                      <p className="mt-0.5 text-sm text-navy-800">{r.subject || r.type}</p>
                      <p className="text-xs text-muted-foreground">{r.kind} · {r.type}{r.language && ` · ${r.language}`}{r.purpose && ` · ${r.purpose}`} · {fmtDateTime(r.created_at)}</p>
                      {r.description && <p className="mt-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">{r.description}</p>}
                      {r.files?.length > 0 && <p className="mt-2 flex flex-wrap gap-1.5">{r.files.map((f: string) => <span key={f} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px]"><Paperclip size={11} />{f}</span>)}</p>}
                    </div>
                    <Pill tone={tone} dot>{label}</Pill>
                  </div>
                  {(r.status === "new" || r.status === "processing") && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {r.status === "new" && <button disabled={busy === r.id} onClick={() => set(r.id, "processing")} className="inline-flex h-10 items-center gap-1.5 rounded-xl border px-4 text-sm font-semibold text-navy-700 hover:bg-navy-50 disabled:opacity-60"><Loader size={15} /> Ishga olish</button>}
                      <button disabled={busy === r.id} onClick={() => set(r.id, "ready")} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"><Check size={15} /> Tayyor</button>
                      <button disabled={busy === r.id} onClick={() => set(r.id, "rejected")} className="inline-flex h-10 items-center gap-1.5 rounded-xl border px-4 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"><X size={15} /> Rad etish</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : <Empty icon={Inbox} title="Murojaat yo‘q" />}
      </Page>
    </AdminPage>
  );
}
