import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format time string from HH:MM:SS to HH:MM */
export function fmtTime(time: string | null | undefined): string {
  if (!time) return ''
  return time.slice(0, 5)
}
