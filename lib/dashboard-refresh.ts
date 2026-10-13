export const DASHBOARD_AUTO_REFRESH_MS = 60_000;

type SetInterval = (callback: () => void, milliseconds: number) => ReturnType<typeof setInterval>;
type ClearInterval = (timer: ReturnType<typeof setInterval>) => void;

export function scheduleDashboardRefresh(
  refresh: () => void,
  setTimer: SetInterval = setInterval,
  clearTimer: ClearInterval = clearInterval,
) {
  const timer = setTimer(refresh, DASHBOARD_AUTO_REFRESH_MS);
  return () => clearTimer(timer);
}
