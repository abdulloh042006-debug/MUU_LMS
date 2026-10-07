"use client";
import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/protected-route";
import { getMyAttendance } from "@/lib/api-service";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AttendanceCheckIn } from "@/components/attendance-check-in";
const labels: Record<string, string> = {
  present: "Qatnashdi",
  absent: "Qatnashmadi",
  late: "Kechikdi",
  excused: "Sababli",
};
export default function Attendance() {
  const [rows, setRows] = useState<any[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    getMyAttendance()
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const attended = rows.filter(
    (row) => row.status === "present" || row.status === "late",
  ).length;
  const attendanceRate = rows.length
    ? Math.round((attended / rows.length) * 100)
    : null;

  return (
    <ProtectedRoute>
      <main className="workspace-page attendance-page">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">MASHG‘ULOTLARDAGI ISHTIROKINGIZ</p>
            <h1>Mening davomatim</h1>
            <p>Ustoz tomonidan qayd etilgan holatlar.</p>
          </div>
        </div>
        <AttendanceCheckIn
          onCheckedIn={async () => setRows(await getMyAttendance())}
        />
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {loading ? (
          <p>Yuklanmoqda…</p>
        ) : (
          <>
            <div className="attendance-summary-grid">
              <Card className="attendance-rate-card">
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">Umumiy davomat</p>
                  <strong>
                    {attendanceRate === null ? "—" : `${attendanceRate}%`}
                  </strong>
                  <span>
                    {rows.length
                      ? `${attended} / ${rows.length} ta dars`
                      : "Hali ma’lumot yo‘q"}
                  </span>
                </CardContent>
              </Card>
              {Object.entries(labels).map(([status, label]) => (
                <Card key={status}>
                  <CardContent className="p-5">
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <strong className="text-3xl">
                      {rows.filter((r) => r.status === status).length}
                    </strong>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardContent className="p-5">
                {rows.map((r) => (
                  <div className="manage-row wrap" key={r.id}>
                    <div>
                      <strong>{r.session_topic}</strong>
                      <small>
                        {r.course_title} ·{" "}
                        {new Date(r.starts_at).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" })}
                      </small>
                      {r.note && <p className="text-sm">{r.note}</p>}
                    </div>
                    <span
                      className={`status-badge ${r.status === "present" ? "done" : "pending"}`}
                    >
                      {labels[r.status]}
                    </span>
                  </div>
                ))}
                {!rows.length && <p>Davomat hali qayd etilmagan.</p>}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </ProtectedRoute>
  );
}
