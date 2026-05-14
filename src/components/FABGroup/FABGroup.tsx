import AiChatWidget from '../AiChatWidget/AiChatWidget'
import MessagesButton from '../MessagesButton/MessagesButton'
import PostServiceFAB from '../PostServiceFAB/PostServiceFAB'
import { useAuthStore } from '../../store/authStore'

export default function FABGroup() {
  const user = useAuthStore((s) => s.user)

  return (
    <div className="hidden md:flex fixed bottom-6 right-5 lg:bottom-6 lg:right-16 z-50 flex-col items-end gap-3">
      <PostServiceFAB grouped />
      {user && <MessagesButton grouped />}
      <AiChatWidget grouped />
    </div>
  )
}
