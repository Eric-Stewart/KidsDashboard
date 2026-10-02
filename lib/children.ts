import type { Child } from "./types";
export const CHILD_NAMES: Record<Child, string> = { E: "Eric", A: "Ada" };
export function childName(child: string) {
  return child === "E" ? "Eric" : child === "A" ? "Ada" : child;
}
