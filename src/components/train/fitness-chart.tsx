import { useEffect, useRef } from 'react'
import type { GenStat } from '../../services/train/runner'

interface FitnessChartProps {
  history: GenStat[]
  width?: number
  height?: number
}

// A small self-contained line chart of best (green) and average (orange) fitness
// per generation, drawn on a canvas so it adds no charting dependency.
const FitnessChart = ({ history, width = 320, height = 180 }: FitnessChartProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#0d0d0d'
    ctx.fillRect(0, 0, width, height)

    const pad = { top: 12, right: 10, bottom: 20, left: 36 }
    const plotW = width - pad.left - pad.right
    const plotH = height - pad.top - pad.bottom

    const maxScore = Math.max(1, ...history.map((h) => h.best))
    const maxGen = Math.max(1, history.length - 1)
    const x = (i: number) => pad.left + (i / maxGen) * plotW
    const y = (score: number) => pad.top + plotH - (score / maxScore) * plotH

    // axes
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(pad.left, pad.top)
    ctx.lineTo(pad.left, pad.top + plotH)
    ctx.lineTo(pad.left + plotW, pad.top + plotH)
    ctx.stroke()

    ctx.fillStyle = '#888'
    ctx.font = '10px monospace'
    ctx.fillText(String(Math.round(maxScore)), 4, pad.top + 4)
    ctx.fillText('0', 4, pad.top + plotH)
    ctx.fillText(`gen ${maxGen}`, pad.left + plotW - 40, height - 6)

    if (history.length === 0) {
      ctx.fillStyle = '#666'
      ctx.fillText('waiting for first generation...', pad.left + 6, pad.top + plotH / 2)
      return
    }

    const drawLine = (pick: (h: GenStat) => number, colour: string) => {
      ctx.strokeStyle = colour
      ctx.lineWidth = 1.5
      ctx.beginPath()
      history.forEach((h, i) => {
        const px = x(i)
        const py = y(pick(h))
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
      ctx.stroke()
    }

    drawLine((h) => h.best, '#3ddc84')
    drawLine((h) => h.avg, '#f5a623')

    // legend
    ctx.font = '11px monospace'
    ctx.fillStyle = '#3ddc84'
    ctx.fillText('best', pad.left + 6, pad.top + 10)
    ctx.fillStyle = '#f5a623'
    ctx.fillText('avg', pad.left + 48, pad.top + 10)
  }, [history, width, height])

  return <canvas ref={canvasRef} style={{ width, height }} />
}

export default FitnessChart
