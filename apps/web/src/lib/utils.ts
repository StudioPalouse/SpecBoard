import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Constrain an attacker-controllable `?from=` value to a same-origin path so it
 * can't be used as an open redirect. Accepts only paths that start with a
 * single "/" (rejecting "//host" protocol-relative URLs and absolute URLs);
 * anything else falls back to `fallback`.
 */
export function safeRedirectPath(from: string | null, fallback = "/"): string {
  if (!from || !from.startsWith("/") || from.startsWith("//")) return fallback;
  return from;
}
