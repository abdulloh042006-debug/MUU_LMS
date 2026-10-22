"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { getBookById, downloadFile } from "@/lib/api-service";
import { ProtectedRoute } from "@/components/protected-route";
import { ErrorNote, Page, PageSkeleton, Pill, useLoad } from "@/components/mu/kit";
import { fmtDateTime } from "@/lib/format";

export default function Material() {
  const { id } = useParams();
  const { data: book, error, loading } = useLoad(() => getBookById(String(id)), [id]);
  const [dlError, setDlError] = useState("");
  const [busy, setBusy] = useState(false);

  async function download() {
    if (!book?.file || busy) return;
    setBusy(true);
    setDlError("");
    try {
      await downloadFile(book.file);
    } catch (e) {
      setDlError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ProtectedRoute>
      <Page>
        <Link href="/materials" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-navy-700">
          <ArrowLeft size={16} /> Materiallar
        </Link>
        {(error || dlError) && <ErrorNote message={error || dlError} />}
        {loading ? (
          <PageSkeleton rows={1} />
        ) : (
          book && (
            <div className="rounded-3xl border bg-white p-6 shadow-card md:p-10">
              <span className="grid size-14 place-items-center rounded-2xl bg-violet-50 text-violet-700"><FileText size={26} /></span>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Pill tone="violet">{book.subject}</Pill>
                <span className="text-xs text-muted-foreground">{book.course_title || "O‘quv materiali"} · {fmtDateTime(book.uploaded_at)}</span>
              </div>
              <h1 className="mt-3 text-2xl font-semibold text-navy-900 md:text-3xl">{book.title}</h1>
              <p className="mt-3 max-w-xl text-sm text-muted-foreground">Fayl himoyalangan: yuklash faqat ushbu kursga kirish huquqingiz bo‘lsa ishlaydi.</p>
              <button onClick={download} disabled={busy} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-navy-700 px-5 py-3 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60">
                <Download size={17} /> {busy ? "Yuklanmoqda…" : "Materialni yuklash"}
              </button>
            </div>
          )
        )}
      </Page>
    </ProtectedRoute>
  );
}
