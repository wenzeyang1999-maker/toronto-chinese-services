// ─── 图片编辑器全局宿主(内测#4) ──────────────────────────────────────────────
// 挂在 App 根部：渲染 imageEditorStore 里的「当前待编辑项」。editImage() 触发。
import { useImageEditorStore } from '../../store/imageEditorStore'
import ImageEditorModal from './ImageEditorModal'

export default function ImageEditorHost() {
  const current = useImageEditorStore((s) => s.current)
  const finish  = useImageEditorStore((s) => s.finish)

  if (!current) return null
  return (
    <ImageEditorModal
      key={current.src}
      src={current.src}
      fileName={current.file.name}
      aspect={current.aspect}
      onCancel={() => finish(null)}
      onSave={(f) => finish(f)}
    />
  )
}
