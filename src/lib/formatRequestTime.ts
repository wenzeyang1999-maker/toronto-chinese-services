// ─── formatRequestTime ─────────────────────────────────────────────────────────
// Renders the service-time window on request cards / map info windows /
// detail pages. Examples:
//   6/1 周日 14:00 — 17:00          (same day)
//   6/1 周日 14:00 — 6/2 周一 10:00 (multi-day)
//   6/1 周日 14:00                  (only start set)

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function datePart(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()} 周${WEEKDAYS[d.getDay()]}`
}

function timePart(d: Date): string {
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${hh}:${mm}`
}

export function formatRequestTime(start?: string | null, end?: string | null): string | null {
  if (!start) return null
  const s = new Date(start)
  if (Number.isNaN(s.getTime())) return null

  const e = end ? new Date(end) : null
  if (!e || Number.isNaN(e.getTime())) {
    return `${datePart(s)} ${timePart(s)}`
  }

  const sameDay = s.toDateString() === e.toDateString()
  if (sameDay) {
    return `${datePart(s)} ${timePart(s)} — ${timePart(e)}`
  }
  return `${datePart(s)} ${timePart(s)} — ${datePart(e)} ${timePart(e)}`
}

/**
 * Convert a Date to the local-tz string that `<input type="datetime-local">`
 * expects: `YYYY-MM-DDTHH:mm` (NO timezone suffix, NO seconds).
 */
export function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
