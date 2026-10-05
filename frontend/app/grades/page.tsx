"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Award,
  ChartNoAxesCombined,
  ChevronRight,
  MessageSquareText,
} from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getMyGrades } from "@/lib/api-service";

interface Grade {
  id: string;
  assignment?: {
    id: string;
    title: string;
    course_title?: string;
    due_date?: string;
  };
  grade?: number | null;
  feedback?: string;
  graded_at?: string;
}

function gradeLabel(value: number) {
  if (value >= 90) return "A’lo";
  if (value >= 80) return "Yaxshi";
  if (value >= 70) return "Qoniqarli";
  return "Yaxshilash kerak";
}

export default function GradesPage() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGrades = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getMyGrades();
        setGrades(Array.isArray(data) ? data : []);
      } catch {
        setError("Baholarni yuklab bo‘lmadi. Qayta urinib ko‘ring.");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchGrades();
  }, []);

  const stats = useMemo(() => {
    const values = grades
      .filter((item) => item.grade !== null && item.grade !== undefined)
      .map((item) => Number(item.grade));

    if (!values.length) {
      return { average: null as number | null, highest: null as number | null, total: 0 };
    }

    return {
      average: Math.round(
        values.reduce((sum, value) => sum + value, 0) / values.length,
      ),
      highest: Math.max(...values),
      total: values.length,
    };
  }, [grades]);

  const sortedGrades = useMemo(
    () =>
      [...grades].sort(
        (a, b) =>
          new Date(b.graded_at || 0).getTime() -
          new Date(a.graded_at || 0).getTime(),
      ),
    [grades],
  );

  return (
    <ProtectedRoute>
      <main className="workspace-page">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">NATIJALAR VA USTOZ IZOHILARI</p>
            <h1>Mening baholarim</h1>
            <p>Baho bilan birga ustoz qoldirgan izohni ham shu yerda ko‘ring.</p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="notification-state">Yuklanmoqda…</div>
        ) : (
          <>
            <section className="grade-summary-grid" aria-label="Baholar statistikasi">
              <div className="grade-summary-primary">
                <span>O‘rtacha natija</span>
                <strong>
                  {stats.average === null ? "—" : stats.average}
                  {stats.average !== null && <small>/100</small>}
                </strong>
                <p>
                  {stats.total
                    ? `${stats.total} ta baholangan topshiriq`
                    : "Hali baho qo‘yilmagan"}
                </p>
              </div>
              <div className="grade-summary-card">
                <Award size={20} />
                <div>
                  <span>Eng yuqori</span>
                  <strong>{stats.highest === null ? "—" : stats.highest}</strong>
                </div>
              </div>
              <div className="grade-summary-card">
                <ChartNoAxesCombined size={20} />
                <div>
                  <span>Baholangan</span>
                  <strong>{stats.total}</strong>
                </div>
              </div>
            </section>

            {!sortedGrades.length ? (
              <div className="empty-message">
                <Award />
                <p>Hozircha baholangan topshiriq yo‘q.</p>
              </div>
            ) : (
              <section className="grade-feed">
                {sortedGrades.map((item) => {
                  const value =
                    item.grade === null || item.grade === undefined
                      ? null
                      : Number(item.grade);

                  return (
                    <Link
                      key={item.id}
                      href={
                        item.assignment?.id
                          ? `/assignments/${item.assignment.id}`
                          : "/assignments"
                      }
                      className="grade-feed-row"
                    >
                      <div className="grade-feed-score">
                        <strong>{value === null ? "—" : value}</strong>
                        <span>{value === null ? "Kutilmoqda" : gradeLabel(value)}</span>
                      </div>

                      <div className="grade-feed-content">
                        <span className="grade-feed-subject">
                          {item.assignment?.course_title || "Topshiriq"}
                        </span>
                        <h2>{item.assignment?.title || "Topshiriq"}</h2>

                        {item.feedback ? (
                          <div className="grade-feedback">
                            <MessageSquareText size={15} />
                            <span>{item.feedback}</span>
                          </div>
                        ) : (
                          <p className="grade-no-feedback">
                            Ustoz izoh qoldirmagan.
                          </p>
                        )}

                        {item.graded_at && (
                          <time dateTime={item.graded_at}>
                            {new Date(item.graded_at).toLocaleDateString("uz-UZ", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                              timeZone: "Asia/Tashkent",
                            })}
                          </time>
                        )}
                      </div>

                      <ChevronRight className="grade-feed-arrow" size={19} />
                    </Link>
                  );
                })}
              </section>
            )}
          </>
        )}
      </main>
    </ProtectedRoute>
  );
}
