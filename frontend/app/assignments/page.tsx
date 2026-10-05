"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  FileText,
  Search,
} from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/auth-context";
import { getAssignments } from "@/lib/api-service";

interface Assignment {
  id: string;
  title: string;
  description?: string;
  course?: number;
  course_title?: string;
  due_date?: string;
  created_at?: string;
  is_submitted?: boolean;
  is_overdue?: boolean;
  allow_late?: boolean;
  course_archived?: boolean;
  attempts_used?: number;
  max_attempts?: number;
}

const actionable = (item: Assignment) =>
  !item.is_submitted && !item.course_archived &&
  (!item.is_overdue || item.allow_late) &&
  (item.attempts_used ?? 0) < (item.max_attempts ?? Infinity);

function deadlineInfo(value?: string, allowLate = false) {
  if (!value) return { label: "Muddat belgilanmagan", tone: "neutral" };
  const target = new Date(value).getTime();
  const now = Date.now();
  const diff = target - now;
  const day = 24 * 60 * 60 * 1000;

  if (diff < 0) return allowLate
    ? { label: "Kech topshirish mumkin", tone: "warning" }
    : { label: "Muddati tugagan", tone: "danger" };
  if (diff <= day) return { label: "Bugun", tone: "warning" };
  if (diff <= 2 * day) return { label: "2 kun ichida", tone: "warning" };

  return {
    label: new Date(value).toLocaleDateString("uz-UZ", {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Tashkent",
    }),
    tone: "neutral",
  };
}

function AssignmentsContent() {
  const course = useSearchParams().get("course");
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getAssignments();
        setAssignments(Array.isArray(data) ? data : []);
      } catch {
        setError("Topshiriqlarni yuklab bo‘lmadi. Qayta urinib ko‘ring.");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchAssignments();
  }, []);

  const filteredAssignments = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    return [...assignments]
      .filter(
        (assignment) =>
          (!course || String(assignment.course) === course) &&
          (!normalized ||
            assignment.title.toLowerCase().includes(normalized) ||
            assignment.description?.toLowerCase().includes(normalized) ||
            assignment.course_title?.toLowerCase().includes(normalized)),
      )
      .sort((a, b) => {
        if (actionable(a) !== actionable(b)) {
          return actionable(a) ? -1 : 1;
        }
        return (
          new Date(a.due_date || "9999-12-31").getTime() -
          new Date(b.due_date || "9999-12-31").getTime()
        );
      });
  }, [assignments, course, searchTerm]);

  const pendingCount = assignments.filter((item) => (!course || String(item.course) === course) && actionable(item)).length;

  return (
    <ProtectedRoute>
      <main className="workspace-page">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">VAZIFALAR VA MUDDATLAR</p>
            <h1>Topshiriqlar</h1>
            <p>
              {user?.role === "student"
                ? pendingCount
                  ? `${pendingCount} ta topshiriq bajarilishi kerak.`
                  : "Hozir bajarilishi mumkin bo‘lgan topshiriq yo‘q."
                : "Topshiriqlarni ko‘ring va boshqaring."}
            </p>
          </div>
          <div className="assignment-toolbar">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Topshiriqlarni qidirish"
                placeholder="Topshiriq yoki fan..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {user?.role !== "student" && (
              <Button asChild>
                <Link href="/manage?tab=assignments">Topshiriqlarni boshqarish</Link>
              </Button>
            )}
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="notification-state">Yuklanmoqda…</div>
        ) : filteredAssignments.length === 0 ? (
          <div className="empty-message">
            <FileText />
            <p>
              {searchTerm
                ? "Qidiruv bo‘yicha topshiriq topilmadi."
                : "Hozircha topshiriqlar yo‘q."}
            </p>
          </div>
        ) : (
          <div className="assignment-cards-grid">
            {filteredAssignments.map((assignment) => {
              const deadline = deadlineInfo(assignment.due_date, assignment.allow_late);
              return (
                <Card
                  key={assignment.id}
                  className={`assignment-card ${assignment.is_submitted ? "submitted" : ""}`}
                >
                  <CardContent className="p-0">
                    <div className="assignment-card-top">
                      <div className="assignment-card-icon">
                        {assignment.is_submitted ? (
                          <CheckCircle2 size={20} />
                        ) : (
                          <FileText size={20} />
                        )}
                      </div>
                      <div className="assignment-card-title">
                        <span>
                          {assignment.course_title || "Dars topshirig‘i"}
                        </span>
                        <h2>{assignment.title}</h2>
                      </div>
                      <span
                        className={`assignment-deadline-pill ${deadline.tone}`}
                      >
                        {deadline.tone === "danger" ? (
                          <AlertCircle size={13} />
                        ) : (
                          <CalendarClock size={13} />
                        )}
                        {deadline.label}
                      </span>
                    </div>

                    {assignment.description && (
                      <p className="assignment-card-description">
                        {assignment.description}
                      </p>
                    )}

                    <div className="assignment-card-footer">
                      <span
                        className={`status-badge ${assignment.is_submitted ? "done" : "pending"}`}
                      >
                        {assignment.is_submitted
                          ? "Topshirildi"
                          : actionable(assignment)
                            ? "Topshirish kerak"
                            : assignment.course_archived
                              ? "Dars arxivlangan"
                              : (assignment.attempts_used ?? 0) >= (assignment.max_attempts ?? Infinity)
                                ? "Urinishlar tugagan"
                                : "Muddat tugagan"}
                      </span>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/assignments/${assignment.id}`}>
                          {assignment.is_submitted ? "Natijani ko‘rish" : "Ochish"}
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}

export default function AssignmentsPage() {
  return <Suspense fallback={<main className="workspace-page">Yuklanmoqda…</main>}><AssignmentsContent /></Suspense>;
}
