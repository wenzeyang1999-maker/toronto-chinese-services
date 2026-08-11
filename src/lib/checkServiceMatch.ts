// ─── 服务贴与业务名片一致性检查(内测2-#9,软提示)──────────────────────────────
// 调 check-service-match 边缘函数;失败一律返回 match:true(软提示绝不阻断发布)。
import { supabase } from './supabase'

export async function checkServiceMatch(
  profile: string,
  service: string,
): Promise<{ match: boolean; reason?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('check-service-match', {
      body: { profile, service },
    })
    if (error || !data) return { match: true }
    return data as { match: boolean; reason?: string }
  } catch {
    return { match: true }
  }
}
