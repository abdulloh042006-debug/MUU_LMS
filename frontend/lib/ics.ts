// Muddatlarni .ics fayl ko‘rinishida yuklab berish (Google/Apple/Outlook taqvimiga qo‘shish uchun).
type IcsEvent = { id: string | number; title: string; start: string; end?: string; description?: string };

const stamp = (d: string | number | Date) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s = "") => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export function downloadIcs(events: IcsEvent[], filename = "muu-muddatlar.ics") {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Millat Umidi//LMS//UZ", "CALSCALE:GREGORIAN"];
  for (const e of events) {
    const end = e.end ?? new Date(new Date(e.start).getTime() + 30 * 60_000).toISOString();
    lines.push(
      "BEGIN:VEVENT",
      `UID:muu-${e.id}@lms`,
      `DTSTAMP:${stamp(Date.now())}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${esc(e.title)}`,
      ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
      "BEGIN:VALARM",
      "TRIGGER:-PT24H",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(e.title)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
