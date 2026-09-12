// ─── VoiceSearchButton ────────────────────────────────────────────────────────
// 搜索栏里的语音小按钮:点一下开始说话,再点停止 → 转写文字回填到搜索框。
// 复用 useVoiceInput(录音→WAV→Whisper),不支持的浏览器自动隐藏。
import { Mic, Square, Loader2 } from 'lucide-react'
import { useVoiceInput } from '../../hooks/useVoiceInput'

interface Props {
  onText: (text: string) => void
  className?: string
}

export default function VoiceSearchButton({ onText, className = '' }: Props) {
  const { supported, isListening, transcribing, toggle } = useVoiceInput(onText)

  if (!supported) return null

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); toggle() }}
      disabled={transcribing}
      aria-label={isListening ? '停止录音' : '语音输入'}
      title={isListening ? '停止录音' : '语音输入'}
      className={`flex-shrink-0 flex items-center justify-center rounded-full w-6 h-6 transition-colors ${
        isListening
          ? 'bg-red-500 text-white animate-pulse'
          : transcribing
            ? 'bg-gray-100 text-gray-400'
            : 'text-gray-400 hover:text-primary-600 hover:bg-primary-50'
      } ${className}`}
    >
      {transcribing
        ? <Loader2 size={14} className="animate-spin" />
        : isListening
          ? <Square size={12} className="fill-current" />
          : <Mic size={14} />}
    </button>
  )
}
