export function cap(value: string, maxLen: number): string {
  return value.slice(0, maxLen).replace(/[\r\n]+/g, ' ').trim()
}
