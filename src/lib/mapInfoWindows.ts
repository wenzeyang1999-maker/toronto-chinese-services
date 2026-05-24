// ─── Map info-window DOM builders ────────────────────────────────────────────
// Builds the HTMLElement content shown inside Google Maps InfoWindow popups.
// Uses createElement + textContent everywhere (no innerHTML) so user-supplied
// data (service title, request title, provider name, skill tags) cannot
// execute as HTML.
import type { Service, ServiceRequest, OnlineProvider } from '../types'
import { formatRequestTime } from './formatRequestTime'

function div(text: string, cssText: string): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText = cssText
  el.textContent = text
  return el
}

export function buildServiceInfo(service: Service, onDetail: () => void, onProvider: () => void): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'min-w-[190px] max-w-[220px] p-1'

  if (service.images?.[0]) {
    const img = document.createElement('img')
    img.src = service.images[0]
    img.alt = service.title
    img.className = 'w-full h-24 object-cover rounded-lg mb-2'
    wrapper.appendChild(img)
  }

  const title = document.createElement('p')
  title.className = 'font-semibold text-gray-900 text-sm leading-tight mb-0.5'
  title.textContent = service.title
  wrapper.appendChild(title)

  const provider = document.createElement('p')
  provider.className = 'text-xs text-gray-500 mb-1'
  provider.textContent = service.provider.rating > 0
    ? `${service.provider.name}  ★ ${service.provider.rating.toFixed(1)}`
    : service.provider.name
  wrapper.appendChild(provider)

  const price = document.createElement('p')
  price.className = 'text-xs font-medium text-primary-600 mb-2'
  price.textContent =
    service.priceType === 'hourly' ? `$${service.price}/时` :
    service.priceType === 'fixed'  ? `$${service.price}起` : '面议'
  wrapper.appendChild(price)

  if (service.location.address) {
    const address = document.createElement('p')
    address.className = 'text-xs text-gray-400 mb-2 truncate'
    address.textContent = `📍 ${service.location.address}`
    wrapper.appendChild(address)
  }

  const row = document.createElement('div')
  row.className = 'flex gap-1.5'

  const detailBtn = document.createElement('button')
  detailBtn.type = 'button'
  detailBtn.className = 'flex-1 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold py-2 rounded-lg transition-colors'
  detailBtn.textContent = '查看详情'
  detailBtn.onclick = onDetail
  row.appendChild(detailBtn)

  const providerBtn = document.createElement('button')
  providerBtn.type = 'button'
  providerBtn.className = 'flex-1 border border-primary-200 text-primary-600 hover:bg-primary-50 text-xs font-semibold py-2 rounded-lg transition-colors'
  providerBtn.textContent = '商家主页'
  providerBtn.onclick = onProvider
  row.appendChild(providerBtn)

  wrapper.appendChild(row)
  return wrapper
}

export function buildDemandInfo(r: ServiceRequest, onClick: () => void): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'padding:10px 14px;min-width:180px'
  wrapper.appendChild(div('🔍 求服务', 'font-size:11px;font-weight:700;color:#ea580c;margin-bottom:4px'))
  wrapper.appendChild(div(r.title, 'font-size:13px;font-weight:600;color:#111;margin-bottom:6px'))
  const serviceTime = formatRequestTime(r.serviceAtStart, r.serviceAtEnd)
  if (serviceTime) {
    wrapper.appendChild(div(`🕒 ${serviceTime}`,
      'font-size:11px;font-weight:600;color:#c2410c;background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:3px 6px;margin-bottom:6px;display:inline-block'))
  }
  if (r.budget) wrapper.appendChild(div(`💰 ${r.budget}`, 'font-size:11px;color:#16a34a;margin-bottom:4px'))
  wrapper.appendChild(div(`还剩 ${r.daysLeft} 天`, 'font-size:11px;color:#888'))
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.style.cssText = 'margin-top:8px;width:100%;background:#ea580c;color:#fff;border:none;border-radius:8px;padding:6px 0;font-size:12px;font-weight:600;cursor:pointer'
  btn.textContent = '查看详情'
  btn.onclick = onClick
  wrapper.appendChild(btn)
  return wrapper
}

export function buildOnlineProviderInfo(p: OnlineProvider, onClick: () => void): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'padding:10px 14px;min-width:160px'
  wrapper.appendChild(div('🟢 在线接单', 'font-size:11px;font-weight:700;color:#16a34a;margin-bottom:4px'))
  wrapper.appendChild(div(p.name, 'font-size:13px;font-weight:600;color:#111;margin-bottom:4px'))
  if (p.skill_tags.length > 0) {
    wrapper.appendChild(div(p.skill_tags.slice(0, 3).join(' · '), 'font-size:11px;color:#6b7280;margin-bottom:6px'))
  }
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.style.cssText = 'width:100%;background:#16a34a;color:#fff;border:none;border-radius:8px;padding:6px 0;font-size:12px;font-weight:600;cursor:pointer'
  btn.textContent = '查看主页'
  btn.onclick = onClick
  wrapper.appendChild(btn)
  return wrapper
}
