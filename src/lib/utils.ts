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

export function getBangkokDateString(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const values = parts.reduce((map, part) => {
    if (part.type !== 'literal') map[part.type] = part.value
    return map
  }, {} as Record<string, string>)

  return `${values.year}-${values.month}-${values.day}`
}
