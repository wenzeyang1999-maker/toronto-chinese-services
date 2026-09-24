-- ─── 冷启动期:「曾经上线过」= 持续显示在线 ───────────────────────────────────
-- 老板决策(2026-09-24,暂时):放宽「在线」新鲜度窗口 —— 只要商家上过一次线,
-- 就一直显示为在线,不再因久未活跃被自动下线。目的:冷启动阶段让地图/商家展示
-- 看起来更活跃。日后可通过重新 schedule 下面的 cron 恢复「久未活跃自动下线」。
--
-- 做两件事:
--   1) 停掉每小时把 last_seen>24h 的人置为 is_online=false 的 cron;
--   2) 回填:凡是曾经上过线(online_lat 有值 = 上线时写过模糊坐标)的号,置为在线。

-- 1) 停掉自动下线 cron(幂等)
SELECT cron.unschedule('reset-offline-users')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reset-offline-users');

-- 2) 回填:曾经上线过的号 → 重新点亮为在线
UPDATE public.users
SET    is_online = true
WHERE  online_lat IS NOT NULL
  AND  COALESCE(is_online, false) = false;
