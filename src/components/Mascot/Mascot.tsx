// ─── 邻邻 Mascot ──────────────────────────────────────────────────────────────
// The 华邻 mascot (a grey bunny with a blue「邻」badge). Renders an optimized
// transparent PNG from /public/mascot/. Use across avatars, empty states,
// loading, success moments to humanize the app.
//   <Mascot pose="hello" size={72} />

export type MascotPose =
  | 'hello' | 'hello2' | 'happy' | 'front' | 'cheer' | 'curious' | 'surprised'
  | 'facepalm' | 'sleep' | 'run' | 'home' | 'delivery' | 'photo' | 'book'
  | 'computer' | 'umbrella' | 'side' | 'cookie' | 'back' | 'crouch'

interface Props {
  pose: MascotPose
  size?: number          // rendered box in px (square)
  className?: string
  alt?: string
  priority?: boolean     // eager-load above-the-fold uses (e.g. loading screen)
}

export default function Mascot({ pose, size = 96, className = '', alt = '邻邻', priority = false }: Props) {
  return (
    <img
      src={`/mascot/linlin-${pose}.png`}
      width={size}
      height={size}
      alt={alt}
      draggable={false}
      loading={priority ? 'eager' : 'lazy'}
      className={`object-contain select-none ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
