#!/usr/bin/env node
// ─── Sitemap Generator ────────────────────────────────────────────────────────
// 查询所有公开内容，生成 sitemap.xml，输出到 ../../public/sitemap.xml
// 建议每周跑一次（或加入 Vercel build hook）
//
// 使用：node seo/generate-sitemap.js
// ─────────────────────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js')
const fs   = require('fs')
const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '../.env') })

const SUPABASE_URL  = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
const SITE_URL      = process.env.SITE_URL || 'https://toronto-chinese-services.vercel.app'

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ 请填写 launch/.env 中的 SUPABASE_URL 和 SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Static pages
const STATIC = [
  { url: '/',           priority: '1.0', changefreq: 'daily'   },
  { url: '/community',  priority: '0.9', changefreq: 'daily'   },
  { url: '/jobs',       priority: '0.9', changefreq: 'daily'   },
  { url: '/secondhand', priority: '0.8', changefreq: 'daily'   },
  { url: '/realestate', priority: '0.8', changefreq: 'daily'   },
  { url: '/events',     priority: '0.8', changefreq: 'daily'   },
  { url: '/search-all', priority: '0.6', changefreq: 'weekly'  },
]

function urlEntry(loc, lastmod, priority = '0.7', changefreq = 'weekly') {
  return `  <url>
    <loc>${SITE_URL}${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
}

async function run() {
  console.log('🗺️  生成 sitemap.xml...\n')

  const today = new Date().toISOString().slice(0, 10)

  const [services, jobs, properties, secondhand, events, community] = await Promise.all([
    supabase.from('services').select('id, created_at').eq('is_available', true).limit(1000),
    supabase.from('jobs').select('id, created_at').eq('is_active', true).limit(1000),
    supabase.from('properties').select('id, created_at').eq('is_active', true).limit(1000),
    supabase.from('secondhand').select('id, created_at').eq('is_active', true).eq('is_sold', false).limit(1000),
    supabase.from('events').select('id, created_at').eq('is_active', true).limit(1000),
    supabase.from('community_posts').select('id, created_at').limit(1000),
  ])

  const entries = [
    // Static
    ...STATIC.map(s => urlEntry(s.url, today, s.priority, s.changefreq)),
    // Services
    ...(services.data ?? []).map(r => urlEntry(`/service/${r.id}`, r.created_at.slice(0, 10), '0.8', 'weekly')),
    // Jobs
    ...(jobs.data ?? []).map(r => urlEntry(`/jobs/${r.id}`, r.created_at.slice(0, 10), '0.7', 'weekly')),
    // Properties
    ...(properties.data ?? []).map(r => urlEntry(`/realestate/${r.id}`, r.created_at.slice(0, 10), '0.7', 'weekly')),
    // Secondhand
    ...(secondhand.data ?? []).map(r => urlEntry(`/secondhand/${r.id}`, r.created_at.slice(0, 10), '0.6', 'weekly')),
    // Events
    ...(events.data ?? []).map(r => urlEntry(`/events/${r.id}`, r.created_at.slice(0, 10), '0.7', 'weekly')),
    // Community
    ...(community.data ?? []).map(r => urlEntry(`/community/${r.id}`, r.created_at.slice(0, 10), '0.6', 'weekly')),
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`

  const outPath = path.join(__dirname, '../../public/sitemap.xml')
  fs.writeFileSync(outPath, xml, 'utf-8')

  console.log(`✅ sitemap.xml 已生成：${outPath}`)
  console.log(`   静态页面: ${STATIC.length}`)
  console.log(`   服务: ${(services.data ?? []).length}`)
  console.log(`   招聘: ${(jobs.data ?? []).length}`)
  console.log(`   房源: ${(properties.data ?? []).length}`)
  console.log(`   闲置: ${(secondhand.data ?? []).length}`)
  console.log(`   活动: ${(events.data ?? []).length}`)
  console.log(`   社区: ${(community.data ?? []).length}`)
  console.log(`   总计: ${entries.length} 条 URL`)
  console.log('\n提示：把 sitemap.xml 提交到 Google Search Console：')
  console.log(`  ${SITE_URL}/sitemap.xml`)
}

run().catch(err => { console.error('❌ 出错了:', err); process.exit(1) })
