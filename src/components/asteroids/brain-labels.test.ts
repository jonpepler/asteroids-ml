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

  it('marks ids 8..15 as the short-range ring', () => {
    expect(describeNode(8).name).toBe('Short-range sensor')
    expect(describeNode(15).kind).toBe('input')
  })

  it('names the four outputs in control order', () => {
    expect(describeNode(16).name).toBe('Fire')
    expect(describeNode(17).name).toBe('Thrust')
    expect(describeNode(18).name).toBe('Turn left')
    expect(describeNode(19).name).toBe('Turn right')
    expect(describeNode(16).kind).toBe('output')
  })

  it('labels grown structure as hidden neurons', () => {
    const label = describeNode(20)
    expect(label.kind).toBe('hidden')
    expect(label.name).toBe('Hidden neuron #20')
  })
})
