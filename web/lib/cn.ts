import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Compose className strings safely. Handles conditional values, falsy values,
 * and merges conflicting Tailwind utilities (later wins).
 *
 *   cn("px-2 py-1", "px-4")           // → "py-1 px-4"
 *   cn("text-sm", isError && "text-bad") // → "text-sm text-bad" (when isError)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
