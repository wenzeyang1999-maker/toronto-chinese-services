// ─── HEIC/HEIF → JPEG 归一化 ──────────────────────────────────────────────────
// iPhone 默认拍照格式是 HEIC。非 Safari 浏览器(Chrome/Firefox/桌面端)无法用
// <img>+canvas 解码 HEIC → compressImage 的 img.onerror 触发 → 原样上传 → 之后
// 到处裂图;更糟的是很多浏览器把 .heic 的 file.type 报成空串，直接被 validate 拒
// 掉，表现为「图片上传失败」。这里在压缩前先把 HEIC 转成 JPEG。
//
// heic2any 依赖 libheif 的 WASM(~1.4MB)，用动态 import 按需加载 —— 只有真的遇到
// HEIC 才下载，不拖累主包。CSP 需含 'wasm-unsafe-eval'(见 vercel.json)。

/** 是否 HEIC/HEIF：优先看 MIME，MIME 为空时看扩展名(浏览器常给空 type)。 */
export function isHeic(file: File): boolean {
  const t = file.type.toLowerCase()
  if (t === 'image/heic' || t === 'image/heif') return true
  if (t === '' || t === 'application/octet-stream') return /\.(heic|heif)$/i.test(file.name)
  return false
}

/** HEIC/HEIF → JPEG。非 HEIC 原样返回；转换失败也原样返回(Safari 仍可能解得了)。 */
export async function normalizeHeic(file: File): Promise<File> {
  if (!isHeic(file)) return file
  try {
    const heic2any = (await import('heic2any')).default
    const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
    const blob = Array.isArray(out) ? out[0] : out
    const name = file.name.replace(/\.(heic|heif)$/i, '.jpg')
    return new File([blob as BlobPart], /\.jpg$/i.test(name) ? name : `${name}.jpg`, { type: 'image/jpeg' })
  } catch {
    return file
  }
}
