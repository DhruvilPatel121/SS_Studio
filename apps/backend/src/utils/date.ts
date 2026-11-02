export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function addHours(date: Date, hours: number): Date {
  const result = new Date(date)
  result.setHours(result.getHours() + hours)
  return result
}

export function isExpired(date: Date): boolean {
  return date < new Date()
}

export function toUTC(date: Date): Date {
  return new Date(date.toISOString())
}