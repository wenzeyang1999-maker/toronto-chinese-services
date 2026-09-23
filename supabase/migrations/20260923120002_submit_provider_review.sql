-- 直接给商家评价(登录即可,无需成交订单)。立即公开(非盲评);每人对每商家一条,可修改。
create or replace function public.submit_provider_review(p_provider uuid, p_rating int, p_comment text default null)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_existing uuid;
begin
  if v_uid is null then raise exception '未登录'; end if;
  if p_rating < 1 or p_rating > 5 then raise exception '请选择 1-5 星'; end if;
  if p_provider = v_uid then raise exception '不能评价自己'; end if;
  if not exists (select 1 from users where id = p_provider) then raise exception '商家不存在'; end if;

  select id into v_existing from reviews
   where reviewer_id = v_uid and provider_id = p_provider and order_id is null and direction = 'client_to_provider'
   limit 1;
  if v_existing is not null then
    update reviews set rating = p_rating, comment = nullif(btrim(coalesce(p_comment,'')),''),
                       created_at = now(), revealed_at = now()
     where id = v_existing;
    return v_existing;
  end if;
  insert into reviews(service_id, provider_id, ratee_id, reviewer_id, direction, rating, comment, order_id, revealed_at)
   values (null, p_provider, p_provider, v_uid, 'client_to_provider', p_rating,
           nullif(btrim(coalesce(p_comment,'')),''), null, now())
   returning id into v_existing;
  return v_existing;
end $$;
revoke all on function public.submit_provider_review(uuid,int,text) from public, anon;
grant execute on function public.submit_provider_review(uuid,int,text) to authenticated;
