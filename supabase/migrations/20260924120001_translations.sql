-- ─── 翻译缓存(英/法运行时机翻)────────────────────────────────────────────────
-- 每条唯一中文文案按 (lang, src_hash) 只翻一次,之后所有人命中缓存(快、免费)。
create table if not exists public.translations (
  lang       text not null,          -- 'en' | 'fr'
  src_hash   text not null,          -- 源中文的哈希
  src        text not null,
  dst        text not null,
  created_at timestamptz not null default now(),
  primary key (lang, src_hash)
);
alter table public.translations enable row level security;
-- UI 文案非隐私:允许公开读缓存(命中不必再调翻译)。写只走边缘函数(service role)。
drop policy if exists translations_read on public.translations;
create policy translations_read on public.translations for select using (true);
grant select on public.translations to anon, authenticated;
