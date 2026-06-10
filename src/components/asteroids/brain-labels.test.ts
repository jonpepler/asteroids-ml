import { describe, expect, it } from 'vitest'
import { describeNode } from './brain-labels'

describe('describeNode', () => {
  it('names the forward long-range sensor', () => {
    const label = describeNode(0)
    expect(label.kind).toBe('input')
    expect(label.name).toBe('Long-range sensor')
    expect(label.detail).toContain('dead ahead')
  })

  it('names a sideways long-range sensor by bearing', () => {
    // id 2 = third long whisker = 90 degrees clockwise from the nose.
    expect(describeNode(2).detail).toContain('90° to the right')
    // id 6 = 270 degrees, reported as the left side.
    expect(describeNode(6).detail).toContain('90° to the left')
  })

  it('marks ids 8..15 as the short-range distance ring', () => {
    expect(describeNode(8).name).toBe('Short-range sensor')
    expect(describeNode(15).kind).toBe('input')
  })

  it('names ids 16..31 as the closing-rate channel for the same whiskers', () => {
    // id 16 mirrors whisker 0 (forward long-range), now as a closing rate.
    const forward = describeNode(16)
    expect(forward.kind).toBe('input')
    expect(forward.name).toBe('Long-range closing rate')
    expect(forward.detail).toContain('dead ahead')
    expect(forward.detail).toContain('approaching')
    // id 24 mirrors whisker 8 (first short-range whisker).
    expect(describeNode(24).name).toBe('Short-range closing rate')
  })

  it('names the ammo-available input at id 32', () => {
    const label = describeNode(32)
    expect(label.kind).toBe('input')
    expect(label.name).toBe('Ammo ready')
  })

  it('names the four outputs in control order', () => {
    expect(describeNode(33).name).toBe('Fire')
    expect(describeNode(34).name).toBe('Thrust')
    expect(describeNode(35).name).toBe('Turn left')
    expect(describeNode(36).name).toBe('Turn right')
    expect(describeNode(33).kind).toBe('output')
  })

  it('labels grown structure as hidden neurons', () => {
    const label = describeNode(37)
    expect(label.kind).toBe('hidden')
    expect(label.name).toBe('Hidden neuron #37')
  })
})
