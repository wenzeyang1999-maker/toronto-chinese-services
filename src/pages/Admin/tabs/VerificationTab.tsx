// ─── Admin · Verification review tab ─────────────────────────────────────────
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { BadgeCheck, ExternalLink, X } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { type VerificationRow } from '../types'
import { useAdminContext } from '../AdminContext'

export default function VerificationTab() {
  const navigate = useNavigate()
  const { acting, setActing, showNotice, runAdminAction } = useAdminContext()
  const [verifications,    setVerifications]    = useState<VerificationRow[]>([])
  const [showVerifHistory, setShowVerifHistory] = useState(false)
  const [verifHistory,     setVerifHistory]     = useState<VerificationRow[]>([])

  async function loadVerifications() {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, qualification_images, verification_status, created_at')
      .eq('verification_status', 'pending')
      .order('created_at', { ascending: false })
    if (error) {
      showNotice('error', `加载认证列表失败：${error.message}`)
      return
    }
    if (data) setVerifications(data as VerificationRow[])
  }

  async function loadVerifHistory() {
    const { data } = await supabase
      .from('users')
      .select('id, name, email, qualification_images, verification_status, created_at')
      .in('verification_status', ['approved', 'rejected'])
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setVerifHistory(data as VerificationRow[])
  }

  async function approveVerification(userId: string) {
    setActing(userId)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_review_verification', {
        target_user_id: userId,
        approved: true,
      })
      if (error) throw error
    }, '已通过认证')
    if (ok !== null) {
      setVerifications(prev => prev.filter(v => v.id !== userId))
    }
    setActing(null)
  }

  async function rejectVerification(userId: string) {
    setActing(userId)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_review_verification', {
        target_user_id: userId,
        approved: false,
      })
      if (error) throw error
    }, '已拒绝认证')
    if (ok !== null) {
      setVerifications(prev => prev.filter(v => v.id !== userId))
    }
    setActing(null)
  }

  useEffect(() => {
    void loadVerifications()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-3">
      {/* Pending / History toggle */}
      <div className="flex gap-1.5">
        <button
          onClick={() => setShowVerifHistory(false)}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            !showVerifHistory ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}>
          待审核 {verifications.length > 0 ? `(${verifications.length})` : ''}
        </button>
        <button
          onClick={() => { setShowVerifHistory(true); if (!verifHistory.length) loadVerifHistory() }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            showVerifHistory ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}>
          已审核记录
        </button>
      </div>

      {showVerifHistory ? (
        verifHistory.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
            <p className="text-sm text-gray-400">暂无已审核记录</p>
          </div>
        ) : (
          <div className="space-y-2">
            {verifHistory.map(v => (
              <div key={v.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 flex-shrink-0 text-sm">
                  {v.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{v.name}</p>
                  <p className="text-xs text-gray-400 truncate">{v.email}</p>
                  <p className="text-xs text-gray-400">{v.created_at.slice(0, 10)}</p>
                </div>
                <span className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-semibold ${
                  v.verification_status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>
                  {v.verification_status === 'approved' ? '已通过' : '已拒绝'}
                </span>
              </div>
            ))}
          </div>
        )
      ) : verifications.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
          <BadgeCheck size={36} className="text-green-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">暂无待审核的认证申请</p>
        </div>
      ) : (
        <div className="space-y-3">
          {verifications.map(v => (
          <motion.div key={v.id}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600
                              flex items-center justify-center text-white font-bold flex-shrink-0">
                {v.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{v.name}</p>
                <p className="text-xs text-gray-400 truncate">{v.email}</p>
              </div>
              <button onClick={() => navigate(`/provider/${v.id}`)}
                className="text-xs text-primary-600 flex items-center gap-1 hover:underline">
                <ExternalLink size={12} /> 查看主页
              </button>
            </div>

            {/* Qualification images preview */}
            {v.qualification_images && v.qualification_images.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {v.qualification_images.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                    className="block aspect-square rounded-xl overflow-hidden border border-gray-100 bg-gray-50 hover:opacity-90 transition-opacity">
                    <img src={url} alt={`资质 ${i + 1}`} className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 mb-3">未上传资质图片</p>
            )}

            <p className="text-xs text-gray-400 mb-3">申请时间：{v.created_at.slice(0, 10)}</p>

            <div className="flex gap-2">
              <button onClick={() => rejectVerification(v.id)} disabled={!!acting}
                className="flex-1 flex items-center justify-center gap-1 text-sm text-gray-500
                           border border-gray-200 rounded-xl py-2.5 hover:bg-gray-50
                           disabled:opacity-50 transition-colors">
                <X size={14} /> 拒绝
              </button>
              <button onClick={() => approveVerification(v.id)} disabled={!!acting}
                className="flex-1 flex items-center justify-center gap-1 text-sm text-white
                           bg-green-500 hover:bg-green-600 rounded-xl py-2.5 font-semibold
                           disabled:opacity-50 transition-colors">
                <BadgeCheck size={14} /> {acting === v.id ? '处理中…' : '批准认证'}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
      )}
    </div>
  )
}
