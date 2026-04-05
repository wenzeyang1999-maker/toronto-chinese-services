#!/usr/bin/env node
// ─── Seed Script ──────────────────────────────────────────────────────────────
// 一键填充种子数据，让平台看起来有内容。
//
// 使用前：
//   1. cp ../.env.example ../.env
//   2. 填入 SUPABASE_SERVICE_KEY 和 SEED_USER_ID
//   3. node seed.js
// ─────────────────────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js')
const { SERVICES, JOBS, COMMUNITY_POSTS } = require('./seed-data')

// Load env
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const SUPABASE_URL      = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const SEED_USER_ID      = process.env.SEED_USER_ID

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !SEED_USER_ID) {
  console.error('❌ 请先填写 launch/.env 中的 SUPABASE_URL、SUPABASE_SERVICE_KEY、SEED_USER_ID')
  process.exit(1)
}

// Use service_role key to bypass RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function run() {
  console.log('🌱 开始填充种子数据...\n')

  // ── A. Services ──────────────────────────────────────────────────────────────
  console.log(`📦 插入 ${SERVICES.length} 条服务...`)
  for (const s of SERVICES) {
    const { error } = await supabase.from('services').insert({
      provider_id:  SEED_USER_ID,
      title:        s.title,
      description:  s.description,
      category_id:  s.category_id,
      price:        s.price,
      price_type:   s.price_type,
      area:         s.area,
      is_available: true,
      images:       [],
    })
    if (error) console.warn(`  ⚠️  ${s.title.slice(0, 30)}… : ${error.message}`)
    else       console.log(`  ✅ ${s.title.slice(0, 40)}`)
  }

  // ── B. Jobs ──────────────────────────────────────────────────────────────────
  console.log(`\n💼 插入 ${JOBS.length} 条招聘...`)
  for (const j of JOBS) {
    const { error } = await supabase.from('jobs').insert({
      poster_id:    SEED_USER_ID,
      title:        j.title,
      description:  j.description,
      listing_type: j.listing_type,
      job_type:     j.job_type,
      category:     j.category,
      salary_min:   j.salary_min,
      salary_max:   j.salary_max,
      salary_type:  j.salary_type,
      area:         [j.area],
      contact_name: j.contact_name,
      contact_phone: j.contact_phone,
      is_active:    true,
    })
    if (error) console.warn(`  ⚠️  ${j.title.slice(0, 30)}… : ${error.message}`)
    else       console.log(`  ✅ ${j.title.slice(0, 40)}`)
  }

  // ── C. Community Posts ────────────────────────────────────────────────────────
  console.log(`\n🏘️  插入 ${COMMUNITY_POSTS.length} 条社区帖子...`)
  for (const p of COMMUNITY_POSTS) {
    const { error } = await supabase.from('community_posts').insert({
      author_id: SEED_USER_ID,
      type:      p.type,
      area:      p.area,
      title:     p.title,
      content:   p.content,
      images:    [],
    })
    if (error) console.warn(`  ⚠️  ${p.title.slice(0, 30)}… : ${error.message}`)
    else       console.log(`  ✅ ${p.title.slice(0, 40)}`)
  }

  console.log('\n🎉 种子数据填充完成！')
  console.log(`   服务: ${SERVICES.length} 条`)
  console.log(`   招聘: ${JOBS.length} 条`)
  console.log(`   社区: ${COMMUNITY_POSTS.length} 条`)
  console.log('\n提示：如需清除种子数据，在 Supabase SQL Editor 运行：')
  console.log(`  DELETE FROM services WHERE provider_id = '${SEED_USER_ID}';`)
  console.log(`  DELETE FROM jobs WHERE poster_id = '${SEED_USER_ID}';`)
  console.log(`  DELETE FROM community_posts WHERE author_id = '${SEED_USER_ID}';`)
}

run().catch(err => { console.error('❌ 出错了:', err); process.exit(1) })
