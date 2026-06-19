import { describe, it, expect } from 'vitest'
import { calcDistance } from './geo'

describe('calcDistance', () => {
  it('returns 0 for identical points', () => {
    expect(calcDistance(43.6532, -79.3832, 43.6532, -79.3832)).toBe(0)
  })

  it('computes the Toronto → Mississauga distance (~26 km)', () => {
    // Toronto downtown vs Mississauga city centre
    const km = calcDistance(43.6532, -79.3832, 43.5890, -79.6441)
    expect(km).toBeGreaterThan(20)
    expect(km).toBeLessThan(32)
  })

  it('is symmetric', () => {
    const a = calcDistance(43.65, -79.38, 43.77, -79.41)
    const b = calcDistance(43.77, -79.41, 43.65, -79.38)
    expect(a).toBeCloseTo(b, 10)
  })
})
