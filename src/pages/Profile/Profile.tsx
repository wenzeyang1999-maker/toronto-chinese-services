// ─── Profile Page ─────────────────────────────────────────────────────────────
// Route: /profile
// Shows the logged-in user's basic info and a logout button.
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, UserCircle, Mail, Phone, LogOut } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

export default function Profile() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  // Not logged in — redirect to login
  if (!user) {
    navigate('/login')
    return null
  }

  const name  = user.user_metadata?.name  || '用户'
  const phone = user.user_metadata?.phone || '未填写'
  const email = user.email || ''

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="w-full bg-white border-b border-gray-200 px-6 h-14 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ChevronLeft size={22} />
        </button>
        <span className="font-semibold text-gray-800">我的账号</span>
      </div>

      <div className="flex-1 px-4 py-8 max-w-md mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="space-y-4"
        >
          {/* Avatar + name */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <UserCircle size={40} className="text-primary-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{name}</p>
              <p className="text-xs text-gray-400 mt-0.5">普通用户</p>
            </div>
          </div>

          {/* Info card */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm divide-y divide-gray-100">
            <InfoRow icon={<Mail size={16} />} label="邮箱" value={email} />
            <InfoRow icon={<Phone size={16} />} label="手机号" value={phone} />
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 text-red-500
                       rounded-2xl py-3.5 text-sm font-medium hover:bg-red-50 transition-colors shadow-sm"
          >
            <LogOut size={16} />
            退出登录
          </button>
        </motion.div>
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <span className="text-gray-400 flex-shrink-0">{icon}</span>
      <span className="text-sm text-gray-500 w-14 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-800 flex-1 truncate">{value}</span>
    </div>
  )
}
