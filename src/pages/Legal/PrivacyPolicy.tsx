import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

const LAST_UPDATED = '2026年5月25日'
const COMPANY_EMAIL = 'privacy@ycs.ca'

export default function PrivacyPolicy() {
  const navigate = useNavigate()

  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = '隐私政策 — 大多伦多华人圈'
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-gray-500 hover:text-gray-800">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-base font-semibold text-gray-800">隐私政策</h1>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-8 space-y-8 text-sm text-gray-700 leading-relaxed">
        <div>
          <p className="text-xs text-gray-400">最后更新：{LAST_UPDATED}</p>
          <p className="mt-3">
            大多伦多华人圈（"本平台"、"我们"）致力于保护您的个人信息。本隐私政策依据加拿大《个人信息保护和电子文件法》（PIPEDA）及安大略省相关法规制定，说明我们如何收集、使用、披露和保护您的信息。
          </p>
        </div>

        <Section title="1. 我们收集的信息">
          <p>注册和使用本平台时，我们可能收集以下信息：</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>账户信息</strong>：姓名、电子邮件地址、电话号码（经 OTP 验证后）、微信号</li>
            <li><strong>服务信息</strong>：您发布的服务内容、服务区域、定价</li>
            <li><strong>需求信息</strong>：您发布的服务需求、预算、时间要求</li>
            <li><strong>位置信息</strong>：经您明确授权后的设备位置（模糊处理至约 1 公里精度后存储）</li>
            <li><strong>通信内容</strong>：您与其他用户之间的消息记录</li>
            <li><strong>使用数据</strong>：页面访问记录、设备类型、浏览器信息（用于改善服务）</li>
            <li><strong>支付意向信息</strong>：我们<strong>不</strong>处理或存储任何支付卡信息。平台仅提供供需对接，资金往来由用户自行完成。</li>
          </ul>
        </Section>

        <Section title="2. 信息使用目的">
          <ul className="list-disc pl-5 space-y-1">
            <li>提供供需匹配、消息通知、地图展示等核心功能</li>
            <li>向您发送与您的服务或需求相关的通知（含电子邮件和短信，依据 CASL 规定）</li>
            <li>验证账户真实性，防范欺诈</li>
            <li>改善平台功能和用户体验</li>
            <li>遵守法律义务（如应法院命令披露）</li>
          </ul>
        </Section>

        <Section title="3. 信息共享">
          <p>我们不会出售您的个人信息。以下情形我们可能共享您的信息：</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>其他用户</strong>：您的公开资料（姓名、服务内容、评分）对平台其他用户可见；联系方式仅在您主动开启会话后对接，不对匿名访客展示。</li>
            <li><strong>服务提供商</strong>：Supabase（数据库及认证）、Vercel（网页托管）、Telnyx（短信）、Resend（邮件）、Google Maps（地图）等基础设施服务商，仅限履行服务所需。</li>
            <li><strong>法律要求</strong>：当法律或监管机构要求时。</li>
          </ul>
        </Section>

        <Section title="4. 位置数据处理">
          <p>
            我们仅在您明确授权（浏览器弹窗同意）后才读取您的位置。存储至数据库的坐标已进行约 1 公里精度的模糊处理，不会披露您的精确地址。您可随时在设备浏览器设置中撤销位置权限。
          </p>
        </Section>

        <Section title="5. CASL 通讯许可">
          <p>
            依据加拿大《反垃圾邮件法》（CASL），我们仅向明确同意接收通讯的用户发送商业电子消息。您可随时通过以下方式退订：
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>点击任意通知邮件底部的"退订"链接</li>
            <li>在「我的主页 → 账户设置 → 通知偏好」中关闭相应选项</li>
            <li>发送邮件至 <a href={`mailto:${COMPANY_EMAIL}`} className="text-primary-600 underline">{COMPANY_EMAIL}</a></li>
          </ul>
          <p className="mt-2">交易性消息（如验证码、账号安全提醒）不受退订限制。</p>
        </Section>

        <Section title="6. 数据存储与安全">
          <ul className="list-disc pl-5 space-y-1">
            <li>您的数据存储于 Supabase 在美国/加拿大的数据中心，受行级安全策略（RLS）保护。</li>
            <li>所有传输均通过 TLS 加密。密码经 bcrypt 哈希存储，我们无法查看您的密码。</li>
            <li>我们定期审查访问权限，限制员工对个人数据的访问。</li>
          </ul>
        </Section>

        <Section title="7. 数据保留">
          <p>
            账户数据在您主动注销后 30 天内删除。消息记录、发布内容在删除请求提交后 90 天内清除（以便处理纠纷）。匿名统计数据可能无限期保留。
          </p>
        </Section>

        <Section title="8. 您的权利（PIPEDA）">
          <p>您有权：</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>访问</strong>：申请查阅我们持有的您的个人信息</li>
            <li><strong>更正</strong>：要求更正不准确的信息</li>
            <li><strong>删除</strong>：要求删除您的账户及相关数据</li>
            <li><strong>可携带性</strong>：申请以结构化格式导出您的数据</li>
            <li><strong>投诉</strong>：向加拿大隐私专员办公室（OPC）提起投诉</li>
          </ul>
          <p className="mt-2">如需行使上述权利，请联系：<a href={`mailto:${COMPANY_EMAIL}`} className="text-primary-600 underline">{COMPANY_EMAIL}</a></p>
        </Section>

        <Section title="9. 未成年人">
          <p>本平台不面向 18 岁以下未成年人。若发现未成年人账户，我们将予以删除。</p>
        </Section>

        <Section title="10. 隐私政策变更">
          <p>
            我们可能不定期更新本政策。重大变更将通过平台通知或电子邮件告知，变更 30 天后生效。继续使用本平台即视为接受更新后的政策。
          </p>
        </Section>

        <Section title="11. 联系我们">
          <p>
            如有任何隐私相关问题，请联系：<br />
            电子邮件：<a href={`mailto:${COMPANY_EMAIL}`} className="text-primary-600 underline">{COMPANY_EMAIL}</a><br />
            我们承诺在 30 个工作日内回复。
          </p>
        </Section>

        <div className="pt-4 border-t border-gray-100 text-xs text-gray-400">
          本隐私政策适用于大多伦多华人圈平台及其移动应用。准据法为加拿大安大略省法律。
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-bold text-gray-900 mb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  )
}
