import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

const LAST_UPDATED = '2026年5月25日'
const CONTACT_EMAIL = 'support@huarenq.com'

export default function TermsOfService() {
  const navigate = useNavigate()

  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = '服务条款 — 大多伦多华人圈'
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-gray-500 hover:text-gray-800">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-base font-semibold text-gray-800">服务条款</h1>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-8 space-y-8 text-sm text-gray-700 leading-relaxed">
        <div>
          <p className="text-xs text-gray-400">最后更新：{LAST_UPDATED}</p>
          <p className="mt-3">
            欢迎使用大多伦多华人圈（"本平台"）。注册账户或使用本平台即表示您同意以下服务条款。请在使用前仔细阅读。
          </p>
        </div>

        <Section title="1. 平台性质与定位">
          <p>
            本平台是面向大多伦多地区华人社区的信息撮合平台，提供服务发布、服务需求、供需对接、社区交流等功能。
          </p>
          <p className="mt-2 font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            ⚠️ 重要：本平台<strong>不</strong>参与任何资金结算、不托管资金、不提供支付担保。所有服务的价格谈判、费用支付及纠纷解决均由用户自行完成。请在充分了解对方信息后再进行线下交易。
          </p>
        </Section>

        <Section title="2. 用户资格">
          <ul className="list-disc pl-5 space-y-1">
            <li>您须年满 18 岁方可注册使用本平台。</li>
            <li>您注册时提供的信息须真实、准确、完整。</li>
            <li>您须对账户安全负责，不得将账户转让他人使用。</li>
            <li>企业用户须以真实企业名称或商户名称注册。</li>
          </ul>
        </Section>

        <Section title="3. 允许的使用行为">
          <p>用户可以：</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>发布合法服务信息（搬家、保洁、报税、律师、补课等）</li>
            <li>发布真实的服务需求</li>
            <li>通过站内消息与其他用户沟通</li>
            <li>对服务进行真实评价</li>
            <li>在社区论坛分享合规内容</li>
          </ul>
        </Section>

        <Section title="4. 禁止行为">
          <p>以下行为将导致账号立即封禁：</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>发布虚假服务信息或欺诈性内容</li>
            <li>发布非法服务（赌博、色情、无证执业的受监管服务等）</li>
            <li>骚扰、威胁或歧视其他用户</li>
            <li>发布未授权的广告或垃圾信息</li>
            <li>冒充他人或企业</li>
            <li>操纵评价系统（刷好评、恶意差评）</li>
            <li>爬取平台数据或滥用 API</li>
            <li>规避平台的安全或身份验证机制</li>
          </ul>
        </Section>

        <Section title="5. 服务内容责任">
          <p>
            本平台对用户发布的服务内容不承担担保责任。我们建议您在选择服务商时：
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>查看服务商的评分和用户评价</li>
            <li>确认对方的资质和执照（如涉及受监管行业）</li>
            <li>优先使用已完成电话验证的服务商</li>
            <li>先小额试用再进行大额交易</li>
            <li>保留书面协议或消息记录</li>
          </ul>
        </Section>

        <Section title="6. 支付与交易安全">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 space-y-2">
            <p className="font-medium text-blue-800">交易安全提示</p>
            <ul className="list-disc pl-5 text-blue-700 space-y-1">
              <li>本平台不处理任何付款，请勿通过平台进行汇款</li>
              <li>建议使用 e-Transfer、支付宝等有记录的支付方式</li>
              <li>大额服务（超过 $500 CAD）建议签订书面合同</li>
              <li>遇到要求提前全额付款的陌生人，请提高警惕</li>
            </ul>
          </div>
          <p className="mt-3">
            对于用户之间发生的任何财务纠纷、服务质量争议，本平台不承担连带责任，但我们会配合相关法律调查提供必要信息。
          </p>
        </Section>

        <Section title="7. 内容所有权与授权">
          <p>
            您保留对自己发布内容的知识产权。通过发布内容，您授予本平台在平台范围内展示、分发该内容的非独家权利。本平台不会将您的原创内容用于平台以外的商业目的。
          </p>
        </Section>

        <Section title="8. 平台权利">
          <p>我们保留以下权利：</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>对违规内容进行删除或修改</li>
            <li>暂停或永久封禁违规账户</li>
            <li>根据法律要求披露用户信息</li>
            <li>修改、暂停或终止平台服务</li>
          </ul>
        </Section>

        <Section title="9. 免责声明">
          <p>
            本平台以"现状"提供服务，不对以下情况承担责任：
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>用户之间交易产生的损失或纠纷</li>
            <li>因服务中断、数据丢失导致的损失</li>
            <li>第三方服务（地图、短信、支付）的可用性</li>
            <li>用户提供的虚假信息造成的损害</li>
          </ul>
          <p className="mt-2">
            在法律允许的最大范围内，本平台对任何间接、偶然、特殊或后果性损害不承担责任。
          </p>
        </Section>

        <Section title="10. 账户注销">
          <p>
            您可随时在「我的主页 → 账户设置」中申请注销账户。注销后，您的公开内容将在 30 天内从平台移除。部分信息（如消息记录）可能依法保留更长时间。
          </p>
        </Section>

        <Section title="11. 条款变更">
          <p>
            我们保留随时更新本条款的权利。重大变更将提前 15 天通过平台通知或电子邮件告知。继续使用平台即视为接受新条款。
          </p>
        </Section>

        <Section title="12. 适用法律与争议解决">
          <p>
            本条款受加拿大安大略省法律管辖。因本条款或平台使用引起的争议，双方应首先尝试协商解决；协商不成可向安大略省有管辖权的法院提起诉讼。
          </p>
        </Section>

        <Section title="13. 联系我们">
          <p>
            如对本条款有疑问，请联系：<br />
            电子邮件：<a href={`mailto:${CONTACT_EMAIL}`} className="text-primary-600 underline">{CONTACT_EMAIL}</a>
          </p>
        </Section>

        <div className="pt-4 border-t border-gray-100 text-xs text-gray-400">
          使用本平台即代表您已阅读并接受本服务条款及隐私政策。
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
