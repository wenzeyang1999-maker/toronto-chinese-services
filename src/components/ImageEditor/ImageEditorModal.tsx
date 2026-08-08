// ─── 图片编辑器弹窗(内测#4) ──────────────────────────────────────────────────
// 裁剪 / 放大 / 缩小 / 拖动(react-easy-crop 内置手势) + 旋转;滤镜后续再加。
import { useCallback, useEffect, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import { RotateCw, X, Check, ZoomIn, ZoomOut } from 'lucide-react'
import { getCroppedFile } from '../../lib/cropImage'

interface Props {
  src: string
  fileName: string
  aspect: number | null           // null = 自由(可选比例)
  onCancel: () => void
  onSave: (file: File) => void
}

const RATIOS: { label: string; value: number | null }[] = [
  { label: '自由', value: null },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: '16:9', value: 16 / 9 },
]

export default function ImageEditorModal({ src, fileName, aspect, onCancel, onSave }: Props) {
  const fixedAspect = aspect != null
  const [naturalRatio, setNaturalRatio] = useState(1)
  const [ratio, setRatio] = useState<number | null>(aspect ?? null)   // 当前选择(null=自由=原图比例)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [area, setArea] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)

  // 读原图比例，供「自由」模式用。
  useEffect(() => {
    const img = new Image()
    img.onload = () => setNaturalRatio(img.naturalWidth / img.naturalHeight || 1)
    img.src = src
  }, [src])

  const onCropComplete = useCallback((_: Area, px: Area) => setArea(px), [])

  const effectiveAspect = ratio ?? naturalRatio

  async function handleSave() {
    if (!area) { onCancel(); return }
    setSaving(true)
    try {
      const f = await getCroppedFile(src, area, rotation, fileName)
      onSave(f)
    } catch {
      setSaving(false)
      onCancel()   // 裁剪失败：当作取消(上层会回退用原图/放弃)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/90">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-4 h-14 flex-shrink-0 text-white pt-safe">
        <button onClick={onCancel} className="p-2 -ml-2 active:scale-95" aria-label="取消">
          <X size={22} />
        </button>
        <span className="text-sm font-semibold">调整图片</span>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1 text-sm font-semibold text-primary-400 disabled:opacity-50 p-2 -mr-2">
          <Check size={18} />{saving ? '处理中' : '完成'}
        </button>
      </div>

      {/* 裁剪区 */}
      <div className="relative flex-1 min-h-0">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={effectiveAspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={onCropComplete}
          showGrid
          restrictPosition
        />
      </div>

      {/* 控制区 */}
      <div className="flex-shrink-0 bg-black/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)] space-y-3">
        {/* 比例选择(仅自由模式) */}
        {!fixedAspect && (
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {RATIOS.map((r) => (
              <button key={r.label} onClick={() => setRatio(r.value)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors
                  ${ratio === r.value ? 'bg-primary-600 text-white' : 'bg-white/10 text-gray-300'}`}>
                {r.label}
              </button>
            ))}
          </div>
        )}

        {/* 缩放 */}
        <div className="flex items-center gap-3 text-white">
          <ZoomOut size={18} className="flex-shrink-0 opacity-70" />
          <input type="range" min={1} max={3} step={0.01} value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-primary-500" aria-label="缩放" />
          <ZoomIn size={18} className="flex-shrink-0 opacity-70" />
          <button onClick={() => setRotation((r) => (r + 90) % 360)}
            className="flex-shrink-0 p-2 rounded-full bg-white/10 active:scale-95" aria-label="旋转">
            <RotateCw size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
