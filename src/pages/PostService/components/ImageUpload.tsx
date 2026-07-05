import { useRef } from 'react'
import { ImagePlus, X } from 'lucide-react'

interface Props {
  previews: string[]
  count: number
  onAdd: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemove: (index: number) => void
}

export default function ImageUpload({ previews, count, onAdd, onRemove }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        服务图片 <span className="text-gray-400 font-normal">（最多 3 张）</span>
      </label>
      <div className="flex gap-2">
        {previews.map((src, i) => (
          <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
            <img loading="lazy" src={src} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70"
            >
              <X size={11} />
            </button>
          </div>
        ))}
        {count < 3 && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-primary-400 hover:text-primary-500 transition-colors flex-shrink-0"
          >
            <ImagePlus size={22} />
            <span className="text-xs">{previews.length === 0 ? '添加图片' : '继续添加'}</span>
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onAdd}
      />
    </div>
  )
}
