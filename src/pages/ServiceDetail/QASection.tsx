// ─── Q&A Section ──────────────────────────────────────────────────────────────
// Public questions & answers on a service listing.
// • Any logged-in user can ask a question
// • Provider + any user can answer publicly
// • Asker can delete their own question; answerer can edit/delete their answer
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { HelpCircle, Send, ChevronDown, ChevronUp, Pencil, X, Check, CornerDownRight, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Answer {
  id:          string
  content:     string
  created_at:  string
  updated_at:  string
  answerer:    { id: string; name: string; avatar_url: string | null } | null
}

interface Question {
  id:         string
  content:    string
  created_at: string
  asker:      { id: string; name: string; avatar_url: string | null } | null
  answers:    Answer[]
  expanded:   boolean
}

interface Props {
  serviceId:  string
  providerId: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function QASection({ serviceId, providerId }: Props) {
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)

  const [questions,    setQuestions]    = useState<Question[]>([])
  const [loading,      setLoading]      = useState(true)

  // Ask form
  const [askText,      setAskText]      = useState('')
  const [asking,       setAsking]       = useState(false)
  const [askError,     setAskError]     = useState<string | null>(null)

  // Answer form per question
  const [answeringId,  setAnsweringId]  = useState<string | null>(null)
  const [answerText,   setAnswerText]   = useState('')
  const [answering,    setAnswering]    = useState(false)
  const [answerError,  setAnswerError]  = useState<string | null>(null)

  // Edit answer
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null)
  const [editAnswerText,  setEditAnswerText]  = useState('')
  const [editAnswering,   setEditAnswering]   = useState(false)

  const isProvider = user?.id === providerId

  // ── Load ──────────────────────────────────────────────────────────────────

  async function load() {
    setLoading(true)
    const { data: qData } = await supabase
      .from('questions')
      .select('id, content, created_at, asker:asker_id(id, name, avatar_url)')
      .eq('service_id', serviceId)
      .order('created_at', { ascending: false })

    if (!qData) { setLoading(false); return }

    const qIds = qData.map((q: any) => q.id)

    const { data: aData } = qIds.length > 0
      ? await supabase
          .from('answers')
          .select('id, question_id, content, created_at, updated_at, answerer:answerer_id(id, name, avatar_url)')
          .in('question_id', qIds)
          .order('created_at', { ascending: true })
      : { data: [] }

    const answersByQ: Record<string, Answer[]> = {}
    ;(aData ?? []).forEach((a: any) => {
      const ans: Answer = {
        id:         a.id,
        content:    a.content,
        created_at: a.created_at,
        updated_at: a.updated_at,
        answerer:   Array.isArray(a.answerer) ? a.answerer[0] : a.answerer,
      }
      if (!answersByQ[a.question_id]) answersByQ[a.question_id] = []
      answersByQ[a.question_id].push(ans)
    })

    setQuestions(qData.map((q: any) => ({
      id:         q.id,
      content:    q.content,
      created_at: q.created_at,
      asker:      Array.isArray(q.asker) ? q.asker[0] : q.asker,
      answers:    answersByQ[q.id] ?? [],
      expanded:   true,
    })))
    setLoading(false)
  }

  useEffect(() => { load() }, [serviceId])

  // ── Ask ───────────────────────────────────────────────────────────────────

  async function submitQuestion() {
    if (!user) { navigate('/login'); return }
    if (!askText.trim()) { setAskError('请输入问题'); return }
    setAsking(true); setAskError(null)
    const { error } = await supabase.from('questions').insert({
      service_id: serviceId,
      asker_id:   user.id,
      content:    askText.trim(),
    })
    setAsking(false)
    if (error) { setAskError('提交失败，请稍后再试'); return }
    setAskText(''); load()
  }

  // ── Delete question ───────────────────────────────────────────────────────

  async function deleteQuestion(qId: string) {
    await supabase.from('questions').delete().eq('id', qId).eq('asker_id', user!.id)
    setQuestions(prev => prev.filter(q => q.id !== qId))
  }

  // ── Answer ────────────────────────────────────────────────────────────────

  async function submitAnswer(qId: string) {
    if (!user) { navigate('/login'); return }
    if (!answerText.trim()) { setAnswerError('请输入回答'); return }
    setAnswering(true); setAnswerError(null)
    const { error } = await supabase.from('answers').insert({
      question_id:  qId,
      answerer_id:  user.id,
      content:      answerText.trim(),
    })
    setAnswering(false)
    if (error) { setAnswerError('提交失败，请稍后再试'); return }
    setAnsweringId(null); setAnswerText(''); load()
  }

  async function saveEditAnswer(answerId: string) {
    if (!user || !editAnswerText.trim()) return
    setEditAnswering(true)
    await supabase.from('answers')
      .update({ content: editAnswerText.trim() })
      .eq('id', answerId).eq('answerer_id', user.id)
    setEditAnswering(false)
    setEditingAnswerId(null); setEditAnswerText(''); load()
  }

  async function deleteAnswer(answerId: string) {
    await supabase.from('answers').delete().eq('id', answerId).eq('answerer_id', user!.id)
    load()
  }

  // ── Toggle expand ──────────────────────────────────────────────────────────

  function toggleExpand(qId: string) {
    setQuestions(prev => prev.map(q => q.id === qId ? { ...q, expanded: !q.expanded } : q))
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }} className="card p-5">

      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <HelpCircle size={16} className="text-primary-500" />
        <h3 className="text-sm font-semibold text-gray-700">问答</h3>
        {questions.length > 0 && (
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {questions.length} 个问题
          </span>
        )}
      </div>

      {/* Ask form */}
      <div className="bg-gray-50 rounded-2xl p-4 mb-4">
        <p className="text-xs font-medium text-gray-600 mb-2">
          {user ? '公开提问，所有人可见' : '登录后可以提问'}
        </p>
        <textarea
          value={askText} onChange={e => setAskText(e.target.value)}
          placeholder="有什么想问的？"
          rows={2} disabled={!user}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none
                     focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white
                     disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {askError && <p className="text-xs text-red-500 mt-1">{askError}</p>}
        <button
          onClick={user ? submitQuestion : () => navigate('/login')}
          disabled={asking}
          className="mt-2 flex items-center gap-1.5 bg-primary-600 text-white text-sm font-medium
                     px-4 py-2 rounded-xl hover:bg-primary-700 disabled:opacity-60 transition-colors"
        >
          <Send size={13} />
          {asking ? '提交中…' : user ? '提交问题' : '登录后提问'}
        </button>
      </div>

      {/* Question list */}
      {loading ? (
        <p className="text-xs text-gray-400 text-center py-4">加载中…</p>
      ) : questions.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">暂无问题，来提第一个问题吧</p>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {questions.map((q, qi) => {
              const isMyQuestion = user?.id === q.asker?.id
              return (
                <motion.div key={q.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -16 }} transition={{ delay: qi * 0.03 }}
                  className="border border-gray-100 rounded-2xl overflow-hidden"
                >
                  {/* Question row */}
                  <div className="flex items-start gap-3 px-4 py-3 bg-white">
                    {/* Avatar */}
                    {q.asker?.avatar_url ? (
                      <img src={q.asker.avatar_url} alt={q.asker.name}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-gray-100 mt-0.5" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600
                                      flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                        {q.asker?.name?.charAt(0) ?? '?'}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-gray-700">{q.asker?.name ?? '匿名'}</span>
                        <span className="text-[11px] text-gray-400">{q.created_at.slice(0, 10)}</span>
                        {isMyQuestion && (
                          <button onClick={() => deleteQuestion(q.id)}
                            className="ml-auto text-[11px] text-gray-300 hover:text-red-400 transition-colors flex items-center gap-0.5">
                            <Trash2 size={11} /> 删除
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-gray-800 mt-0.5 leading-relaxed">{q.content}</p>
                    </div>

                    {/* Expand toggle */}
                    <button onClick={() => toggleExpand(q.id)}
                      className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors mt-0.5">
                      {q.expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>

                  {/* Answers + reply form */}
                  <AnimatePresence>
                    {q.expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-gray-100 bg-gray-50"
                      >
                        {/* Existing answers */}
                        {q.answers.map(a => {
                          const isMyAnswer     = user?.id === a.answerer?.id
                          const isProviderAnswer = a.answerer?.id === providerId
                          return (
                            <div key={a.id} className="flex gap-2 px-4 py-3 border-b border-gray-100 last:border-0">
                              <CornerDownRight size={13} className="text-primary-300 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                {editingAnswerId === a.id ? (
                                  <>
                                    <textarea
                                      value={editAnswerText}
                                      onChange={e => setEditAnswerText(e.target.value)}
                                      rows={2}
                                      className="w-full border border-primary-200 rounded-xl px-3 py-2 text-xs resize-none
                                                 focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                                    />
                                    <div className="flex gap-2 mt-1.5">
                                      <button onClick={() => setEditingAnswerId(null)}
                                        className="flex items-center gap-0.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white transition-colors">
                                        <X size={11} /> 取消
                                      </button>
                                      <button onClick={() => saveEditAnswer(a.id)} disabled={editAnswering}
                                        className="flex items-center gap-0.5 text-xs px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60 transition-colors">
                                        <Check size={11} /> {editAnswering ? '保存中…' : '保存'}
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`text-xs font-semibold ${isProviderAnswer ? 'text-primary-700' : 'text-gray-700'}`}>
                                        {isProviderAnswer ? '🏪 服务商' : (a.answerer?.name ?? '匿名')}
                                      </span>
                                      <span className="text-[11px] text-gray-400">{a.created_at.slice(0, 10)}</span>
                                      {isMyAnswer && (
                                        <div className="ml-auto flex gap-2">
                                          <button onClick={() => { setEditingAnswerId(a.id); setEditAnswerText(a.content) }}
                                            className="text-[11px] text-gray-400 hover:text-primary-600 transition-colors flex items-center gap-0.5">
                                            <Pencil size={10} /> 编辑
                                          </button>
                                          <button onClick={() => deleteAnswer(a.id)}
                                            className="text-[11px] text-gray-400 hover:text-red-400 transition-colors flex items-center gap-0.5">
                                            <Trash2 size={10} /> 删除
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{a.content}</p>
                                  </>
                                )}
                              </div>
                            </div>
                          )
                        })}

                        {/* Answer input */}
                        {user && (
                          answeringId === q.id ? (
                            <div className="px-4 py-3">
                              <textarea
                                value={answerText} onChange={e => setAnswerText(e.target.value)}
                                rows={2}
                                placeholder={isProvider ? '回复客户问题…' : '分享你的经验…'}
                                className="w-full border border-primary-200 rounded-xl px-3 py-2 text-xs resize-none
                                           focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                              />
                              {answerError && <p className="text-xs text-red-500 mt-0.5">{answerError}</p>}
                              <div className="flex gap-2 mt-2">
                                <button onClick={() => { setAnsweringId(null); setAnswerText(''); setAnswerError(null) }}
                                  className="flex items-center gap-0.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white transition-colors">
                                  <X size={11} /> 取消
                                </button>
                                <button onClick={() => submitAnswer(q.id)} disabled={answering}
                                  className="flex items-center gap-0.5 text-xs px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60 transition-colors">
                                  <Send size={11} /> {answering ? '提交中…' : isProvider ? '回答' : '分享回答'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="px-4 py-2.5">
                              <button
                                onClick={() => { setAnsweringId(q.id); setAnswerText(''); setAnswerError(null) }}
                                className={`text-xs font-medium flex items-center gap-1 transition-colors ${
                                  isProvider
                                    ? 'text-primary-600 hover:text-primary-800'
                                    : 'text-gray-400 hover:text-gray-600'
                                }`}
                              >
                                <CornerDownRight size={12} />
                                {isProvider ? '回答此问题' : '我也知道，分享回答'}
                              </button>
                            </div>
                          )
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  )
}
