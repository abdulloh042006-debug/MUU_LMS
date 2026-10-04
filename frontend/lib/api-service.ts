import { config } from "./config";

let accessToken: string | null = null;
let refreshing: Promise<void> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function clearAccessToken() {
  accessToken = null;
}

async function refreshToken() {
  if (!refreshing)
    refreshing = (async () => {
      const response = await fetch("/api/token/refresh/", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) {
        clearAccessToken();
        throw new Error("Sessiya tugadi. Qayta kiring.");
      }
      const data = await response.json();
      setAccessToken(data.access);
    })().finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function restoreSession() {
  await refreshToken();
}

export async function logoutSession() {
  try {
    await fetch("/api/logout/", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(config.API_TIMEOUT),
    });
  } finally {
    clearAccessToken();
  }
}

async function fetchAPI(
  endpoint: string,
  options: RequestInit = {},
  retry = true,
): Promise<any> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const publicRequest =
    endpoint === "/login/" ||
    endpoint === "/register/" ||
    endpoint === "/health/";
  if (accessToken && !publicRequest)
    headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${config.API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(config.API_TIMEOUT),
  });
  if (response.status === 401 && !publicRequest && retry) {
    await refreshToken();
    return fetchAPI(endpoint, options, false);
  }
  const data =
    response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      data
        ? Object.entries(data)
            .map(
              ([key, value]) =>
                `${key}: ${Array.isArray(value) ? value.join(" ") : value}`,
            )
            .join("; ")
        : `Server xatosi (${response.status})`,
    );
  return data;
}
const post = (data: any): RequestInit => ({
  method: "POST",
  body: data instanceof FormData ? data : JSON.stringify(data),
});
const assignment = (a: any) => ({
  ...a,
  id: String(a.id),
  due_date: a.deadline,
});
export const login = (username: string, password: string) =>
  fetchAPI("/login/", post({ username, password }));
export const register = (u: any) =>
  fetchAPI(
    "/register/",
    post({
      username: u.username,
      email: u.email,
      fullname:
        `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.username,
      password: u.password,
      confirm_password: u.confirm_password,
    }),
  );
export async function getUserProfile() {
  const u = await fetchAPI("/user/profile/");
  return {
    ...u,
    id: String(u.id),
    name: u.fullname,
    first_name: u.fullname.split(" ")[0],
    last_name: u.fullname.split(" ").slice(1).join(" "),
  };
}
export const updateUserProfile = (u: any) =>
  fetchAPI("/user/profile/update/v2/", {
    method: "PATCH",
    body: JSON.stringify(u),
  });
export async function changePassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
) {
  const data = await fetchAPI(
    "/user/password/change/",
    post({
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    }),
  );
  setAccessToken(data.access);
  return data;
}
export const getBooks = () => fetchAPI("/books/");
export const getBookById = (id: string) => fetchAPI(`/books/${id}/`);
export async function getAssignments() {
  return (await fetchAPI("/assignments/")).map(assignment);
}
export async function getAssignmentById(id: string) {
  return assignment(await fetchAPI(`/assignments/${id}/`));
}
export async function getMyGrades() {
  return (await fetchAPI("/grades/my/"))
    .filter(
      (g: any, i: number, all: any[]) =>
        all.findIndex((x) => x.assignment.id === g.assignment.id) === i,
    )
    .map((g: any) => ({
      ...g,
      grade: g.grade === null ? null : Number(g.grade),
      assignment: assignment(g.assignment),
    }));
}
export async function getCalendar() {
  return (await fetchAPI("/calendar/")).map((e: any) => ({
    ...e,
    start_date: e.start_time,
    end_date: e.end_time,
  }));
}
export const createBook = (data: FormData) =>
  fetchAPI("/books/create/", post(data));
export const createAssignment = (data: any) =>
  fetchAPI("/assignments/create/", post(data));
export const createCalendarEvent = (data: any) =>
  fetchAPI("/calendar/create/", post(data));
export const submitAssignment = (id: string, file: File) => {
  const data = new FormData();
  data.append("file", file);
  return fetchAPI(`/assignments/${id}/submit/`, post(data));
};
export async function testConnection() {
  try {
    await fetchAPI("/health/");
    return { success: true, error: "" };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function downloadFile(path: string, retry = true): Promise<void> {
  const url = new URL(path, window.location.origin);
  if (
    url.origin !== window.location.origin ||
    !url.pathname.startsWith("/media/")
  )
    throw new Error("Fayl manzili noto‘g‘ri.");
  const headers = new Headers();
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(url.pathname, {
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  if (response.status === 401 && retry) {
    await refreshToken();
    return downloadFile(path, false);
  }
  if (!response.ok) throw new Error("Faylni yuklab bo‘lmadi.");
  const blob = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = blob;
  anchor.download = decodeURIComponent(
    url.pathname.split("/").pop() || "download",
  );
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(blob), 1000);
}

export const getCourses = () => fetchAPI("/courses/");
export const createCourse = (data: any) => fetchAPI("/courses/", post(data));
export const updateCourse = (id: number, data: any) =>
  fetchAPI(`/courses/${id}/`, { method: "PATCH", body: JSON.stringify(data) });
export const getCourseStudents = (id: number) =>
  fetchAPI(`/courses/${id}/students/`);
export const addCourseStudent = (id: number, username: string) =>
  fetchAPI(`/courses/${id}/students/`, post({ username }));
export const removeCourseStudent = (id: number, student: number) =>
  fetchAPI(`/courses/${id}/students/${student}/`, { method: "DELETE" });
export const getSubmissions = (id: string) =>
  fetchAPI(`/assignments/${id}/submissions/`);
export const getTeacherSubmissions = () => fetchAPI("/grades/teacher/");
export const gradeSubmission = (id: number, grade: number, feedback: string) =>
  fetchAPI(`/grades/${id}/set/`, post({ grade, feedback }));
export const updateAssignment = (id: number, data: any) =>
  fetchAPI(`/assignments/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
export const removeAssignment = (id: number) =>
  fetchAPI(`/assignments/${id}/`, { method: "DELETE" });
export const updateBook = (id: number, data: any) =>
  fetchAPI(`/books/${id}/`, { method: "PATCH", body: JSON.stringify(data) });
export const removeBook = (id: number) =>
  fetchAPI(`/books/${id}/`, { method: "DELETE" });
export const removeEvent = (id: number) =>
  fetchAPI(`/calendar/${id}/`, { method: "DELETE" });
export const getAttendanceSessions = () => fetchAPI("/attendance/");
export const createAttendanceSession = (data: any) =>
  fetchAPI("/attendance/", post(data));
export const getAttendanceRecords = (id: number) =>
  fetchAPI(`/attendance/${id}/`);
export const saveAttendance = (id: number, records: any[]) =>
  fetchAPI(`/attendance/${id}/`, {
    method: "PUT",
    body: JSON.stringify({ records }),
  });
export const getMyAttendance = () => fetchAPI("/attendance/my/");
export const getActiveAttendance = () => fetchAPI("/attendance/active/");
export const getAttendanceChallenge = (id: number) =>
  fetchAPI(`/attendance/${id}/challenge/`);
export const checkInAttendance = (data: {
  session: number;
  channel: "qr" | "ultrasound";
  proof: string;
  latitude: number;
  longitude: number;
  accuracy: number;
}) => fetchAPI("/attendance/check-in/", post(data));
export const finalizeAttendance = (id: number) =>
  fetchAPI(`/attendance/${id}/finalize/`, post({}));
export const getNotifications = () => fetchAPI("/notifications/");
export const markNotificationRead = (id: number) =>
  fetchAPI(`/notifications/${id}/read/`, post({}));
export const markAllNotificationsRead = () =>
  fetchAPI("/notifications/read-all/", post({}));
