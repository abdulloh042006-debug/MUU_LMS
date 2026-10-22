"use client";

import { Mic } from "lucide-react";
import { StaffPage } from "@/components/mu/staff";
import { getGrantInterviews } from "@/lib/api-service";
import { Empty, ErrorNote, IconChip, Notice, Page, PageHeader, PageSkeleton, Pill, useLoad } from "@/components/mu/kit";
import { fmtFull, fmtTime } from "@/lib/format";

export default function GrantInterviews() {
  const { data, loading, error, reload } = useLoad(() => getGrantInterviews());
  const rows = (data ?? []) as any[];
  return (
    <StaffPage>
      <Page>
        <PageHeader eyebrow="Ish" title="Grant suhbatlari" description="Siz ishtirok etadigan grant suhbatlari jadvali." />
        <div className="mb-4"><Notice tone="gold">Namunaviy (demo) ma’lumotlar.</Notice></div>
        {error ? <ErrorNote message="Bu bo‘lim hozircha faqat demo rejimda mavjud." onRetry={reload} /> : loading ? <PageSkeleton rows={2} /> : rows.length ? (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-card">
                <IconChip icon={Mic} tone="gold" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-navy-900">{r.candidate}</p>
                  <p className="text-xs text-muted-foreground">{fmtFull(r.starts_at)}, {fmtTime(r.starts_at)} · {r.room}</p>
                </div>
                <Pill tone="blue" dot>Rejalashtirilgan</Pill>
              </li>
            ))}
          </ul>
        ) : <Empty icon={Mic} title="Suhbat yo‘q" />}
      </Page>
    </StaffPage>
  );
}
