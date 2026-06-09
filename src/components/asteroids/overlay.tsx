import '../style/asteroids/overlay.scss'

interface AstroOverlayProps {
  gameState?: number
}

const AstroOverlay = ({ gameState }: AstroOverlayProps) => (
  <>
    {gameState === 1 ? (
      <div className="astro-overlay">YOU WIN</div>
    ) : gameState === 2 ? (
      <div className="astro-overlay">YOU LOSE</div>
    ) : (
      ''
    )}
  </>
)

export default AstroOverlay
