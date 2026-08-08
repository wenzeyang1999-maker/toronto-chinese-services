// ─── 按裁剪框 + 旋转导出为 JPEG File ──────────────────────────────────────────
// 配合 react-easy-crop：onCropComplete 给出的 croppedAreaPixels(像素级裁剪区) +
// rotation(度)→ canvas 绘制 → 输出 JPEG File。后续 compressImage 还会再压到显示
// 尺寸，这里质量给 0.92 保底清晰。

export interface PixelArea { x: number; y: number; width: number; height: number }

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export async function getCroppedFile(
  src: string,
  area: PixelArea,
  rotation: number,
  fileName: string,
): Promise<File> {
  const image = await loadImage(src)
  const rad = (rotation * Math.PI) / 180

  // 先把整图画到一个「已旋转」的画布上，再从中截取裁剪区。
  const bBoxW = Math.abs(Math.cos(rad) * image.width) + Math.abs(Math.sin(rad) * image.height)
  const bBoxH = Math.abs(Math.sin(rad) * image.width) + Math.abs(Math.cos(rad) * image.height)

  const rotCanvas = document.createElement('canvas')
  rotCanvas.width = bBoxW
  rotCanvas.height = bBoxH
  const rctx = rotCanvas.getContext('2d')!
  rctx.translate(bBoxW / 2, bBoxH / 2)
  rctx.rotate(rad)
  rctx.drawImage(image, -image.width / 2, -image.height / 2)

  const out = document.createElement('canvas')
  out.width = Math.round(area.width)
  out.height = Math.round(area.height)
  const octx = out.getContext('2d')!
  octx.drawImage(
    rotCanvas,
    Math.round(area.x), Math.round(area.y), Math.round(area.width), Math.round(area.height),
    0, 0, Math.round(area.width), Math.round(area.height),
  )

  const blob: Blob = await new Promise((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.92),
  )
  const name = fileName.replace(/\.[^.]+$/, '') + '.jpg'
  return new File([blob], name, { type: 'image/jpeg' })
}
