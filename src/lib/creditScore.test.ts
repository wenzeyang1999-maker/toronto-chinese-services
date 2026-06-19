import { describe, it, expect } from 'vitest'
import { computeCreditScore, CREDIT_MAX } from './creditScore'

describe('computeCreditScore', () => {
  it('scores 0 with nothing verified', () => {
    const r = computeCreditScore({ emailVerified: false, phoneVerified: false, idOrBusinessVerified: false })
    expect(r.score).toBe(0)
    expect(r.stars).toBe(0)
  })

  it('scores the max (10) with everything verified', () => {
    const r = computeCreditScore({ emailVerified: true, phoneVerified: true, idOrBusinessVerified: true })
    expect(r.score).toBe(CREDIT_MAX)
    expect(r.stars).toBe(5)
  })

  it('adds the points of each verified item (email 3 + id 3 = 6)', () => {
    const r = computeCreditScore({ emailVerified: true, phoneVerified: false, idOrBusinessVerified: true })
    expect(r.score).toBe(6)
    expect(r.stars).toBe(3)
  })

  it('subtracts the penalty and floors at 0', () => {
    const r = computeCreditScore({
      emailVerified: true, phoneVerified: false, idOrBusinessVerified: false, creditPenalty: 5,
    })
    // base 3 − penalty 5 → floored to 0
    expect(r.score).toBe(0)
  })

  it('lists a penalty row in the breakdown when a penalty applies', () => {
    const r = computeCreditScore({
      emailVerified: true, phoneVerified: true, idOrBusinessVerified: true, creditPenalty: 2,
    })
    expect(r.score).toBe(8)
    expect(r.breakdown.some(i => i.label === '投诉扣分')).toBe(true)
  })
})
