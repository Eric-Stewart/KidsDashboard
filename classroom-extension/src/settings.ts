export interface Settings {
  apiUrl: string;
  child: "E" | "A";
  expectedEmail: string;
  key: string;
  followLinks: boolean;
}
export function apiOrigin(value: string) {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["", "/"].includes(url.pathname)
  )
    throw new Error("Use the dashboard base URL, without a path.");
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw new Error("Use HTTPS, or HTTP on localhost for local development.");
  if (url.hostname === "google.com" || url.hostname.endsWith(".google.com"))
    throw new Error("Use the KidsDashboard URL, not a Google URL.");
  return url.origin;
}
export function settingsId(s: Settings) {
  return `${s.apiUrl}|${s.child}|${s.expectedEmail}`;
}
export function validateSettings(input: Settings): Settings {
  if (
    !["E", "A"].includes(input.child) ||
    !/^\S+@\S+\.\S+$/.test(input.expectedEmail)
  )
    throw new Error("Select a child and enter their school Google email.");
  if (!input.key || input.key.length < 32 || input.key.length > 256)
    throw new Error(
      "Enter the KidsDashboard ingestion key (at least 32 characters).",
    );
  return {
    ...input,
    apiUrl: apiOrigin(input.apiUrl),
    expectedEmail: input.expectedEmail.toLowerCase().trim(),
    followLinks: input.followLinks === true,
  };
}
