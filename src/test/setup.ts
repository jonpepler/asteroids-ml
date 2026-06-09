import '@testing-library/jest-dom/vitest'

// jsdom has no canvas 2d backend, so any component that calls getContext('2d')
// (e.g. the fitness chart) logs a noisy "not implemented" error. Those
// components already treat a null context as "nothing to draw", so return null
// quietly and keep the test output clean.
HTMLCanvasElement.prototype.getContext = () => null
