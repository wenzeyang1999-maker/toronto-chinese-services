import { useRef, useState } from 'react'
import { toast } from '../lib/toast'

// ─── 语音输入 hook（录音 → WAV → Groq Whisper 转写）───────────────────────────
// 跨浏览器可靠（含 Safari/iOS），支持普通话/英语/中英混说。转写结果通过 onText 回调
// 交给调用方（追加到输入框等）。与发需求弹窗同一套后端 transcribe-audio。
const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// 把 MediaRecorder 录音(webm/mp4)解码后重编码成单声道 WAV(保持原采样率)。
// MediaRecorder 生成的 webm 头常缺时长信息，服务端解码只读到静音 → Whisper 幻觉；
// WAV 头永远正确。不重采样：Safari 的 OfflineAudioContext 不支持 16k 会抛错。
async function toWavMono(blob: Blob): Promise<{ wav: Blob; rms: number }> {
  const arrayBuf = await blob.arrayBuffer()
  const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext
  const ctx = new AudioCtx()
  const decoded = await ctx.decodeAudioData(arrayBuf)
  ctx.close()

  const n  = decoded.length
  const ch = decoded.numberOfChannels
  const mono = new Float32Array(n)
  for (let c = 0; c < ch; c++) {
    const d = decoded.getChannelData(c)
    for (let i = 0; i < n; i++) mono[i] += d[i] / ch
  }
  let sum = 0
  for (let i = 0; i < n; i++) sum += mono[i] * mono[i]
  const rms = Math.sqrt(sum / Math.max(1, n))
  return { wav: encodeWav(mono, decoded.sampleRate), rms }
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)) }
  writeStr(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); writeStr(8, 'WAVE')
  writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  writeStr(36, 'data'); view.setUint32(40, samples.length * 2, true)
  let off = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    off += 2
  }
  return new Blob([view], { type: 'audio/wav' })
}

export function useVoiceInput(onText: (text: string) => void) {
  const [isListening,  setIsListening]  = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const streamRef        = useRef<MediaStream | null>(null)

  const supported = typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      streamRef.current = stream
      chunksRef.current = []
      const mime = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : ''
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
        void transcribe()
      }
      mediaRecorderRef.current = rec
      rec.start()
      setIsListening(true)
    } catch (err: any) {
      setIsListening(false)
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        toast('麦克风被拒绝。请在浏览器/系统设置里允许麦克风后重试', 'error')
      } else if (err?.name === 'NotFoundError') {
        toast('未检测到麦克风设备，请检查后重试', 'error')
      } else {
        toast('无法开始录音，请重试或改用手动输入', 'error')
      }
    }
  }

  function stop() {
    const rec = mediaRecorderRef.current
    if (rec && rec.state !== 'inactive') rec.stop()   // 触发 onstop → transcribe()
    setIsListening(false)
  }

  async function transcribe() {
    const type = mediaRecorderRef.current?.mimeType || 'audio/webm'
    const raw  = new Blob(chunksRef.current, { type })
    chunksRef.current = []
    if (raw.size === 0) return
    setTranscribing(true)
    try {
      let file: Blob = raw
      let filename = `voice.${type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : 'webm'}`
      try {
        const { wav, rms } = await toWavMono(raw)
        if (rms < 0.003) {   // 基本静音 → 采集问题
          toast('没检测到声音，请确认麦克风选对、音量足够后再试', 'error')
          return
        }
        file = wav
        filename = 'voice.wav'
      } catch { /* 解码失败则退回原始音频直接上传 */ }

      const fd = new FormData()
      fd.append('file', file, filename)
      fd.append('language', 'auto')   // 自动识别：普通话 / 英语 / 中英混说
      const res = await fetch(`${SUPABASE_URL}/functions/v1/transcribe-audio`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: fd,
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error((data as { error?: string } | null)?.error || 'fail')
      const text = (data as { text?: string } | null)?.text?.trim()
      if (!text) {
        toast('没听清，请靠近麦克风、稍慢些再说一次', 'info')
        return
      }
      onText(text)
    } catch {
      toast('语音识别失败，请重试或手动输入', 'error')
    } finally {
      setTranscribing(false)
    }
  }

  return {
    supported,
    isListening,
    transcribing,
    start,
    stop,
    toggle: () => (isListening ? stop() : start()),
  }
}
