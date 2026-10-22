"use client";

import { useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { StaffPage } from "@/components/mu/staff";
import { getSentMessages, sendStaffMessage } from "@/lib/api-service";
import { Empty, ErrorNote, Page, PageHeader, Panel, Pill, useLoad } from "@/components/mu/kit";
import { fmtDateTime } from "@/lib/format";

const field = "w-full rounded-xl border bg-white px-3 text-sm outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-200";

export default function Messages() {
  const { data, error, reload } = useLoad(() => getSentMessages());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusy(true);
    setErr("");
    try {
      await sendStaffMessage(Object.fromEntries(fd.entries()));
      form.reset();
      reload();
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x));
    } finally {
      setBusy(false);
    }
  }

  const rows = (data ?? []) as any[];
  return (
    <StaffPage>
      <Page>
        <PageHeader eyebrow="Kampus" title="Xabar yuborish" description="Guruh talabalariga e’lon yuboring." />
        {error ? <ErrorNote message="Bu bo‘lim hozircha faqat demo rejimda mavjud." onRetry={reload} /> : (
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <Panel title="Yangi xabar" icon={Send}>
              <form onSubmit={send} className="space-y-3.5">
                {err && <ErrorNote message={err} />}
                <select name="group" className={`${field} h-11`}><option>IT102-26</option><option>IT102-27</option></select>
                <input name="subject" required placeholder="Mavzu" className={`${field} h-11`} />
                <textarea name="text" required rows={5} placeholder="Xabar matni…" className={`${field} py-2.5`} />
                <button disabled={busy} className="h-11 w-full rounded-xl bg-navy-700 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60">{busy ? "Yuborilmoqda…" : "Yuborish"}</button>
              </form>
            </Panel>
            <Panel title="Yuborilganlar">
              {rows.length ? (
                <ul className="divide-y">
                  {rows.map((m) => (
                    <li key={m.id} className="py-3">
                      <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-navy-900">{m.subject}</p><Pill tone="navy">{m.group}</Pill></div>
                      <p className="mt-1 text-xs text-slate-600">{m.text}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{fmtDateTime(m.created_at)}</p>
                    </li>
                  ))}
                </ul>
              ) : <Empty title="Hali xabar yuborilmagan" text="Demo rejimda xabarlar faqat shu sessiyada saqlanadi." />}
            </Panel>
          </div>
        )}
      </Page>
    </StaffPage>
  );
}
