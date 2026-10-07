export const ATTENDANCE_ERROR_MESSAGES = {
  already_checked_in: "Davomat allaqachon tasdiqlangan.",
  code_expired: "Kod muddati tugagan. Ustozdan yangi kodni so‘rang.",
  code_invalid: "Kod noto‘g‘ri. Belgilarni tekshirib, qayta kiriting.",
  session_not_active: "Davomat sessiyasi faol emas yoki vaqti tugagan.",
  not_enrolled: "Siz ushbu dars guruhiga biriktirilmagansiz.",
  rate_limited: "Urinishlar ko‘p. Bir daqiqadan keyin qayta urinib ko‘ring.",
} as const;

export type AttendanceErrorCode = keyof typeof ATTENDANCE_ERROR_MESSAGES;

export const CLIENT_FAILURE_REASONS = [
  "camera_denied",
  "camera_dismissed",
  "camera_no_device",
  "camera_insecure",
  "camera_unsupported",
  "camera_error",
  "ultrasound_unsupported",
  "ultrasound_insecure",
  "ultrasound_low_volume",
  "ultrasound_noise",
  "ultrasound_timeout",
  "microphone_denied",
  "microphone_no_device",
  "microphone_error",
] as const;

export type ClientFailureReason = (typeof CLIENT_FAILURE_REASONS)[number];

export function getAttendanceErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code in ATTENDANCE_ERROR_MESSAGES) {
      return ATTENDANCE_ERROR_MESSAGES[code as AttendanceErrorCode];
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return "Davomatni tasdiqlab bo‘lmadi. Qayta urinib ko‘ring.";
}

const MANUAL_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function normalizeAttendanceCode(value: string): string {
  return Array.from(value.toUpperCase())
    .filter((character) => MANUAL_CODE_ALPHABET.includes(character))
    .slice(0, 8)
    .join("");
}

export type ClientEnvironment = {
  browser: "Chrome" | "Safari" | "Samsung" | "Edge" | "Firefox" | "Other";
  os: "Android" | "iOS" | "Windows" | "macOS" | "Linux" | "Other";
};

export function getClientEnvironment(
  userAgent: string,
  platform = "",
  maxTouchPoints = 0,
): ClientEnvironment {
  const browser: ClientEnvironment["browser"] = /SamsungBrowser/i.test(userAgent)
    ? "Samsung"
    : /Edg(e|A|iOS)?\//i.test(userAgent)
      ? "Edge"
      : /Firefox|FxiOS/i.test(userAgent)
        ? "Firefox"
        : /CriOS|Chrome/i.test(userAgent)
          ? "Chrome"
          : /Safari/i.test(userAgent)
            ? "Safari"
            : "Other";
  const isIPad = platform === "MacIntel" && maxTouchPoints > 1;
  const os: ClientEnvironment["os"] = /Android/i.test(userAgent)
    ? "Android"
    : /iPhone|iPad|iPod/i.test(userAgent) || isIPad
      ? "iOS"
      : /Windows/i.test(userAgent)
        ? "Windows"
        : /Macintosh|Mac OS X/i.test(userAgent) || platform.startsWith("Mac")
          ? "macOS"
          : /Linux/i.test(userAgent) || platform.startsWith("Linux")
            ? "Linux"
            : "Other";
  return { browser, os };
}

export function getUltrasoundFallback(input: {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  isSecureContext: boolean;
  hasGetUserMedia: boolean;
  hasAudioContext: boolean;
}): "ios" | "insecure" | "unsupported" | null {
  const environment = getClientEnvironment(
    input.userAgent,
    input.platform,
    input.maxTouchPoints,
  );
  if (environment.os === "iOS") return "ios";
  if (!input.isSecureContext) return "insecure";
  if (!input.hasGetUserMedia || !input.hasAudioContext) return "unsupported";
  return null;
}

export type CameraIssue =
  | "denied"
  | "dismissed"
  | "no_device"
  | "insecure"
  | "unsupported"
  | "error";

export function classifyCameraIssue(input: {
  errorName?: string;
  isSecureContext: boolean;
  hasGetUserMedia: boolean;
  permissionState?: PermissionState | null;
}): CameraIssue {
  if (!input.isSecureContext) return "insecure";
  if (!input.hasGetUserMedia) return "unsupported";
  if (["NotFoundError", "DevicesNotFoundError"].includes(input.errorName ?? "")) {
    return "no_device";
  }
  if (["NotAllowedError", "PermissionDeniedError"].includes(input.errorName ?? "")) {
    return input.permissionState === "denied" ? "denied" : "dismissed";
  }
  if (input.errorName === "AbortError") return "dismissed";
  return "error";
}

export type CameraHelp = { title: string; description: string; steps: string[] };

export function getCameraHelp(issue: CameraIssue, browser: ClientEnvironment["browser"]): CameraHelp {
  const permissionSteps =
    browser === "Safari"
      ? ["iPhone/iPad: Settings → Apps → Safari → Camera → Allow.", "Sahifani qayta ochib, QR skanerni yana bosing."]
      : browser === "Samsung"
        ? ["Manzil satridagi qulf/site belgisini bosing.", "Permissions → Camera → Allow ni tanlang va sahifani yangilang."]
        : browser === "Chrome"
          ? ["Manzil satridagi qulf/site belgisini bosing.", "Site settings → Camera → Allow ni tanlang, so‘ng sahifani yangilang."]
          : ["Brauzerning sayt ruxsatlari bo‘limidan Camera → Allow ni tanlang.", "Sahifani qayta ochib, QR skanerni yana bosing."];

  const help: Record<CameraIssue, CameraHelp> = {
    denied: {
      title: "Kamera ruxsati rad etildi",
      description: "Brauzer kamera ishlatishga ruxsat bermadi.",
      steps: permissionSteps,
    },
    dismissed: {
      title: "Kamera ruxsat oynasi yopildi",
      description: "Ruxsat so‘rovini yopgan bo‘lishingiz mumkin. Ruxsatni sozlamalardan yoqing yoki qayta so‘rang.",
      steps: permissionSteps,
    },
    no_device: {
      title: "Kamera topilmadi",
      description: "Kamera boshqa ilovada band yoki qurilmada mavjud emas.",
      steps: ["Kameradan foydalanayotgan boshqa ilovani yoping.", "Kamera ruxsatini tekshiring yoki ustoz ko‘rsatgan 8 belgili kodni kiriting."],
    },
    insecure: {
      title: "Xavfsiz ulanish kerak",
      description: "Brauzer kamerani faqat HTTPS orqali ishlatadi.",
      steps: ["Sayt manzili https:// bilan boshlanishini tekshiring.", "Oddiy HTTP havoladan kamerani ochib bo‘lmaydi; ustozning 8 belgili kodidan foydalaning."],
    },
    unsupported: {
      title: "Kamera funksiyasi qo‘llanmaydi",
      description: "Bu brauzerda kamera API mavjud emas.",
      steps: ["Chrome, Safari yoki Samsung Internet’ning yangilangan versiyasini oching.", "Hozircha davomatni 8 belgili kod bilan tasdiqlang."],
    },
    error: {
      title: "Kamera ochilmadi",
      description: "Kamera ishga tushmadi. Ruxsat va qurilma ulanishini tekshiring.",
      steps: permissionSteps,
    },
  };
  return help[issue];
}

export type MicrophoneIssue = "denied" | "no_device" | "error";

export function classifyMicrophoneIssue(errorName?: string): MicrophoneIssue {
  if (["NotAllowedError", "PermissionDeniedError"].includes(errorName ?? "")) return "denied";
  if (["NotFoundError", "DevicesNotFoundError"].includes(errorName ?? "")) return "no_device";
  return "error";
}

export const ULTRASOUND_MESSAGES = {
  unsupported: "Bu brauzer/qurilmada ultrasound ishonchli ishlamaydi. QR yoki 8 belgili koddan foydalaning.",
  insecure: "Mikrofon uchun HTTPS kerak. QR yoki 8 belgili koddan foydalaning.",
  denied: "Mikrofon ruxsati rad etildi. Sayt ruxsatlaridan Microphone → Allow ni tanlab, qayta urinib ko‘ring.",
  no_device: "Mikrofon topilmadi. Qurilma mikrofonini yoqing yoki QR/8 belgili koddan foydalaning.",
  low_volume: "Signal juda past. Telefonni karnayga yaqinlashtiring, ovozni ko‘taring va qayta urinib ko‘ring.",
  noise: "Atrofdagi shovqin signalni to‘smoqda. Jimroq joyda qayta urinib ko‘ring yoki QR/koddan foydalaning.",
  timeout: "9 soniyada ultrasound signali kelmadi. Ustoz signalini qayta yoqtirib, yaqinroqdan urinib ko‘ring.",
  error: "Mikrofon ishga tushmadi. Ruxsatni tekshirib, qayta urinib ko‘ring.",
} as const;

export function classifyUltrasoundSignal(input: {
  maxSignalDb: number;
  backgroundDb: number;
  preambleSeen: boolean;
}): "low_volume" | "noise" | "timeout" {
  if (input.maxSignalDb < -82) return "low_volume";
  if (input.backgroundDb > -35 || (!input.preambleSeen && input.backgroundDb > input.maxSignalDb - 8)) {
    return "noise";
  }
  return "timeout";
}

export function getUltrasoundFallbackMessage(
  fallback: "ios" | "insecure" | "unsupported",
): string {
  if (fallback === "ios") return "iPhone/iPad’da ultrasound o‘rniga QR skaner yoki 8 belgili kod avtomatik taklif qilinadi.";
  if (fallback === "insecure") return ULTRASOUND_MESSAGES.insecure;
  return ULTRASOUND_MESSAGES.unsupported;
}

export function getUltrasoundFailureReason(
  issue: "unsupported" | "insecure" | "denied" | "no_device" | "low_volume" | "noise" | "timeout" | "error",
): ClientFailureReason {
  const reasons: Record<typeof issue, ClientFailureReason> = {
    unsupported: "ultrasound_unsupported",
    insecure: "ultrasound_insecure",
    denied: "microphone_denied",
    no_device: "microphone_no_device",
    low_volume: "ultrasound_low_volume",
    noise: "ultrasound_noise",
    timeout: "ultrasound_timeout",
    error: "microphone_error",
  };
  return reasons[issue];
}

export function getCameraFailureReason(issue: CameraIssue): ClientFailureReason {
  const reasons: Record<CameraIssue, ClientFailureReason> = {
    denied: "camera_denied",
    dismissed: "camera_dismissed",
    no_device: "camera_no_device",
    insecure: "camera_insecure",
    unsupported: "camera_unsupported",
    error: "camera_error",
  };
  return reasons[issue];
}

export function supportsCameraControls(capabilities: {
  torch?: boolean;
  facingMode?: string[];
}): { torch: boolean; switchCamera: boolean } {
  const modes = capabilities.facingMode ?? [];
  return {
    torch: capabilities.torch === true,
    switchCamera: modes.includes("environment") && modes.includes("user"),
  };
}

export function isAllowedClientFailureReason(value: string): value is ClientFailureReason {
  return (CLIENT_FAILURE_REASONS as readonly string[]).includes(value);
}

export function isAllowedBrowser(value: string): value is ClientEnvironment["browser"] {
  return ["Chrome", "Safari", "Samsung", "Edge", "Firefox", "Other"].includes(value);
}

export function isAllowedOs(value: string): value is ClientEnvironment["os"] {
  return ["Android", "iOS", "Windows", "macOS", "Linux", "Other"].includes(value);
}
