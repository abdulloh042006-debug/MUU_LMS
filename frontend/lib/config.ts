export const config = {
  API_BASE_URL: "/api",
  DEVELOPMENT_MODE: false,
  ENABLE_OFFLINE_MODE: false,
  API_TIMEOUT: 15000,
}
export const isDevelopment = process.env.NODE_ENV === "development"
