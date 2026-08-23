// ─── 邻邻 Mascot ──────────────────────────────────────────────────────────────
// The 华邻 mascot (a grey bunny with a blue「邻」badge). Renders an optimized
// transparent PNG from /public/mascot/. Use across avatars, empty states,
// loading, success moments to humanize the app.
//   <Mascot pose="hello" size={72} />

export type MascotPose =
  | 'hello' | 'hello2' | 'happy' | 'front' | 'cheer' | 'curious' | 'surprised'
  | 'facepalm' | 'sleep' | 'run' | 'home' | 'delivery' | 'photo' | 'book'
  | 'computer' | 'umbrella' | 'side' | 'cookie' | 'back' | 'crouch'

// 无图占位用的「友好」姿势池(排除 facepalm/surprised 等不适合占位的表情)。
const PLACEHOLDER_POSES: MascotPose[] = [
  'front', 'hello', 'hello2', 'happy', 'curious', 'cheer',
  'book', 'photo', 'cookie', 'side', 'home', 'delivery',
]

// 按 id 稳定地取一个姿势:同一张卡永远同一个(不闪),不同卡各异。
export function poseFromSeed(seed: string): MascotPose {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return PLACEHOLDER_POSES[Math.abs(h) % PLACEHOLDER_POSES.length]
}

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
