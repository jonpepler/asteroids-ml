import type { SketchProps } from 'react-p5'

// The exact p5 instance type react-p5 passes to its callbacks. Deriving it from
// react-p5 (rather than importing @types/p5 directly) keeps our handlers
// assignable to <Sketch> and avoids clashing p5 type versions.
export type P5 = Parameters<NonNullable<SketchProps['draw']>>[0]

// @types/p5 exposes `keyCode` as a global, not an instance property, but the
// instance does carry it at runtime. Use this where a key handler reads it.
export type P5WithKeyCode = P5 & { keyCode: number }
