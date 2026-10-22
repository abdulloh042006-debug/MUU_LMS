import { Award, Bell, BookOpen, ClipboardList, FileCheck2, GraduationCap, ScanLine } from "lucide-react";
import type { ElementType } from "react";
import type { Tone } from "@/components/mu/kit";

export function notifyMeta(type: string): { icon: ElementType; tone: Tone; label: string } {
  switch (type) {
    case "grade":
      return { icon: Award, tone: "green", label: "Baho" };
    case "assignment":
      return { icon: ClipboardList, tone: "amber", label: "Topshiriq" };
    case "material":
      return { icon: BookOpen, tone: "violet", label: "Material" };
    case "submission":
      return { icon: FileCheck2, tone: "blue", label: "Javob" };
    case "attendance":
      return { icon: ScanLine, tone: "navy", label: "Davomat" };
    case "course":
      return { icon: GraduationCap, tone: "gold", label: "Kurs" };
    default:
      return { icon: Bell, tone: "neutral", label: "Tizim" };
  }
}
