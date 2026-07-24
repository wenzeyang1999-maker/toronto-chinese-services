-- 短信每日预算护栏 + 预警。Telnyx 按条计费($0.004/条),没有免费额度,且有被刷风险。
-- 两个发送函数(auth-sms-hook / send-otp)共享一个每日计数:超过硬顶就停发(护成本),
-- 达到预警阈值时给所有管理员发一条站内通知(每天只发一次)。

CREATE TABLE IF NOT EXISTS public.sms_daily_count (
  day     date    PRIMARY KEY DEFAULT current_date,
  count   int     NOT NULL DEFAULT 0,
  alerted boolean NOT NULL DEFAULT false
);
ALTER TABLE public.sms_daily_count ENABLE ROW LEVEL SECURITY;  -- 仅 definer/service_role 可访问

-- 记一条短信发送:原子自增今日计数,返回是否放行 + 是否触发预警。
-- 首次达到 p_alert_at 当天,顺带给所有管理员插一条站内预警通知。
CREATE OR REPLACE FUNCTION public.record_sms_send(
  p_daily_cap int DEFAULT 300,
  p_alert_at  int DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_count    int;
  v_alerted  boolean;
  v_do_alert boolean := false;
BEGIN
  INSERT INTO public.sms_daily_count (day, count)
  VALUES (current_date, 1)
  ON CONFLICT (day) DO UPDATE SET count = sms_daily_count.count + 1
  RETURNING count, alerted INTO v_count, v_alerted;

  IF v_count >= p_alert_at AND NOT v_alerted THEN
    UPDATE public.sms_daily_count SET alerted = true WHERE day = current_date;
    v_do_alert := true;
    INSERT INTO public.notifications (recipient_id, type, title, body, link_url)
    SELECT u.id, 'sms_budget_alert', '⚠️ 短信用量预警',
           format('今日已发送 %s 条短信,接近每日上限 %s 条,请留意 Telnyx 费用/是否被刷', v_count, p_daily_cap),
           '/admin'
    FROM public.users u WHERE u.role = 'admin';
  END IF;

  RETURN jsonb_build_object(
    'count',   v_count,
    'allowed', v_count <= p_daily_cap,
    'alert',   v_do_alert
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_sms_send(int, int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_sms_send(int, int) TO service_role;
