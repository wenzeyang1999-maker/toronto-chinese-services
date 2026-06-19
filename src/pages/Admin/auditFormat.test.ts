import { describe, it, expect } from 'vitest'
import { formatLogKey, formatLogValue } from './auditFormat'

describe('formatLogKey', () => {
  it('translates known keys', () => {
    expect(formatLogKey('role')).toBe('角色')
    expect(formatLogKey('membership_expires_at')).toBe('到期时间')
  })

  it('falls back to a humanised key for unknown keys', () => {
    expect(formatLogKey('some_unknown_key')).toBe('some unknown key')
  })
})

describe('formatLogValue', () => {
  it('renders empty values as 无', () => {
    expect(formatLogValue(null)).toBe('无')
    expect(formatLogValue(undefined)).toBe('无')
    expect(formatLogValue('')).toBe('无')
  })

  it('joins arrays with 、', () => {
    expect(formatLogValue(['a', 'b', 'c'])).toBe('a、b、c')
  })

  it('renders booleans as 是 / 否', () => {
    expect(formatLogValue(true)).toBe('是')
    expect(formatLogValue(false)).toBe('否')
  })

  it('translates known status / role strings', () => {
    expect(formatLogValue('open')).toBe('待处理')
    expect(formatLogValue('banned')).toBe('已封禁')
    expect(formatLogValue('admin')).toBe('管理员')
  })

  it('passes through unknown strings unchanged', () => {
    expect(formatLogValue('hello')).toBe('hello')
  })
})
