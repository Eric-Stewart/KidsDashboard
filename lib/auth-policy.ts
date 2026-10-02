export function demoEnabled(env: NodeJS.ProcessEnv = process.env) {
  return (
    env.NODE_ENV === "development" && env.DEMO_MODE === "true" && !env.VERCEL
  );
}
export function allowedParent(
  email: string | undefined,
  verified: boolean,
  allowlist = process.env.PARENT_EMAILS || "",
) {
  return (
    verified &&
    !!email &&
    allowlist
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .includes(email.toLowerCase())
  );
}
