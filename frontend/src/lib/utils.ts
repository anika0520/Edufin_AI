import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Safe error message extractor (avoids catch(e: any)) ─────────────────────
export interface ApiError {
  response?: { data?: { message?: string } };
  message?: string;
}
export function getErrMsg(e: unknown, fallback = "Something went wrong"): string {
  const err = e as ApiError;
  return err?.response?.data?.message || err?.message || fallback;
}
