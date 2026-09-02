interface Star {
  x: number
  y: number
  size: number
  twinkleDelay: number
  id: string
}

// Seeded, so the server and the client draw the same sky.
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function generateStars(
  count: number,
  size: { min: number; max: number },
  seed: number
): Star[] {
  const random = mulberry32(seed)

  return Array.from({ length: count }, (_, index) => ({
    x: Math.floor(random() * 100),
    y: Math.floor(random() * 100),
    size: random() * (size.max - size.min) + size.min,
    twinkleDelay: random() * 5,
    id: `star-${index}`,
  }))
}

const SPEEDS = { slow: "4s", normal: "2s", fast: "1s" }

export function SkyBg({
  starCount = 50,
  color = "var(--primary)",
  size = { min: 1, max: 3 },
  speed = "normal",
  seed = 7,
}: {
  starCount?: number
  color?: string
  size?: { min: number; max: number }
  speed?: keyof typeof SPEEDS
  seed?: number
}) {
  const stars = generateStars(starCount, size, seed)

  return (
    <div className="pointer-events-none absolute inset-0 z-[-1] overflow-hidden">
      <style>{`
        @keyframes changelog-twinkle {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
      `}</style>
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full will-change-[opacity]"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            transform: "translate(-50%, -50%)",
            width: `${star.size}px`,
            height: `${star.size}px`,
            backgroundColor: color,
            animation: `changelog-twinkle ${SPEEDS[speed]} ease-in-out infinite`,
            animationDelay: `${star.twinkleDelay}s`,
          }}
        />
      ))}
    </div>
  )
}
