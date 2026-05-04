import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, Search, ImagePlus, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAppStore } from '../../store/appStore'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import { CATEGORIES } from '../../data/categories'
import type { PostServiceForm } from '../../types'
import Header from '../../components/Header/Header'
import { compressImage, validateImageFile } from '../../lib/compressImage'
import LocationInput, { type LocationResult } from '../../components/LocationInput/LocationInput'
import { generateServiceDraft } from '../../lib/aiTools'
import { notifyFollowerNewService } from '../../lib/notify'
import { toast } from '../../lib/toast'

// ── 内置服务库（搜索用）──────────────────────────────────────────────────────
type ServiceCat = 'moving' | 'cleaning' | 'ride' | 'renovation' | 'cashwork' | 'food' | 'other'
interface ServiceSuggestion { name: string; category: ServiceCat; tags: string[] }

const BUILTIN_SERVICES: ServiceSuggestion[] = [
  // 搬家
  { name: '本地搬家',       category: 'moving',     tags: ['搬家','搬运','货车','move'] },
  { name: '长途搬运',       category: 'moving',     tags: ['搬家','长途','跨城'] },
  { name: '钢琴搬运',       category: 'moving',     tags: ['钢琴','搬运','搬家'] },
  { name: '办公室搬迁',     category: 'moving',     tags: ['搬迁','办公室','公司'] },
  { name: '家具打包',       category: 'moving',     tags: ['打包','搬家','包装'] },
  { name: '家具拆装',       category: 'moving',     tags: ['拆装','家具','安装','ikea','宜家'] },
  // 保洁
  { name: '日常保洁',       category: 'cleaning',   tags: ['保洁','清洁','打扫'] },
  { name: '深度清洁',       category: 'cleaning',   tags: ['深度','清洁','打扫'] },
  { name: '搬家清洁',       category: 'cleaning',   tags: ['搬家','清洁','交房'] },
  { name: '地毯清洗',       category: 'cleaning',   tags: ['地毯','清洗','carpet'] },
  { name: '窗户清洁',       category: 'cleaning',   tags: ['窗户','玻璃','清洁'] },
  { name: '消毒杀菌',       category: 'cleaning',   tags: ['消毒','杀菌','除菌'] },
  // 接送
  { name: '机场接送',       category: 'ride',       tags: ['机场','接送','airport'] },
  { name: '包车服务',       category: 'ride',       tags: ['包车','租车','司机'] },
  { name: '顺风车',         category: 'ride',       tags: ['顺风','拼车','carpooling'] },
  { name: '代驾服务',       category: 'ride',       tags: ['代驾','司机','开车'] },
  { name: '学生接送',       category: 'ride',       tags: ['学生','接送','孩子','课外','上学'] },
  { name: '跨城接送',       category: 'ride',       tags: ['跨城','长途','接送'] },
  // 装修
  { name: '室内装修',       category: 'renovation', tags: ['装修','室内','renovation'] },
  { name: '水电维修',       category: 'renovation', tags: ['水电','维修','水管','电路'] },
  { name: 'IKEA家具安装',   category: 'renovation', tags: ['ikea','宜家','安装','家具'] },
  { name: '油漆涂装',       category: 'renovation', tags: ['油漆','涂装','刷漆','paint'] },
  { name: '贴砖',           category: 'renovation', tags: ['贴砖','瓷砖','tile','铺砖'] },
  { name: '木工地板',       category: 'renovation', tags: ['木工','地板','flooring'] },
  { name: '管道疏通',       category: 'renovation', tags: ['管道','疏通','堵塞','plumbing'] },
  { name: '屋顶维修',       category: 'renovation', tags: ['屋顶','roof','维修','漏水'] },
  { name: '门窗安装',       category: 'renovation', tags: ['门','窗','安装','更换'] },
  // 现金工
  { name: '搬运工',         category: 'cashwork',   tags: ['搬运','力工','日结','现金'] },
  { name: '清洁工',         category: 'cashwork',   tags: ['清洁','日结','现金工'] },
  { name: '建筑工人',       category: 'cashwork',   tags: ['建筑','工地','现金','日结'] },
  { name: '仓库工',         category: 'cashwork',   tags: ['仓库','工厂','日结','warehouse'] },
  { name: '农场工',         category: 'cashwork',   tags: ['农场','farm','季节工','日结'] },
  { name: '餐厅帮工',       category: 'cashwork',   tags: ['餐厅','帮工','后厨','日结'] },
  { name: '装卸工',         category: 'cashwork',   tags: ['装卸','搬运','日结','现金'] },
  // 餐饮
  { name: '私房菜',         category: 'food',       tags: ['私房菜','做饭','厨师','上门'] },
  { name: '月子餐',         category: 'food',       tags: ['月子','月子餐','坐月子','产后'] },
  { name: '厨师上门',       category: 'food',       tags: ['厨师','上门','做饭','宴席'] },
  { name: '烘焙甜点',       category: 'food',       tags: ['烘焙','甜点','蛋糕','面包'] },
  { name: '外卖配送',       category: 'food',       tags: ['外卖','配送','delivery'] },
  { name: '喜宴包办',       category: 'food',       tags: ['宴席','喜宴','包办','婚宴'] },
  // 教育教学
  { name: '钢琴教学',       category: 'other',      tags: ['钢琴','音乐','教学','piano','教练','老师'] },
  { name: '吉他教学',       category: 'other',      tags: ['吉他','guitar','音乐','教学','教练'] },
  { name: '小提琴教学',     category: 'other',      tags: ['小提琴','violin','音乐','教学','教练'] },
  { name: '声乐教学',       category: 'other',      tags: ['声乐','唱歌','歌唱','教学','教练'] },
  { name: '中文家教',       category: 'other',      tags: ['家教','中文','补习','tutor','教练','老师'] },
  { name: '数学家教',       category: 'other',      tags: ['数学','math','补习','家教','教练','tutor'] },
  { name: '英文家教',       category: 'other',      tags: ['英文','english','补习','家教','tutor','教练'] },
  { name: '法语教学',       category: 'other',      tags: ['法语','french','教学','教练','tutor'] },
  { name: '游泳教练',       category: 'other',      tags: ['游泳','swimming','教练','coach'] },
  { name: '网球教练',       category: 'other',      tags: ['网球','tennis','教练','coach'] },
  { name: '羽毛球教练',     category: 'other',      tags: ['羽毛球','badminton','教练','coach'] },
  { name: '篮球教练',       category: 'other',      tags: ['篮球','basketball','教练','coach'] },
  { name: '乒乓球教练',     category: 'other',      tags: ['乒乓球','乒乓','table tennis','教练','coach'] },
  { name: '高尔夫教练',     category: 'other',      tags: ['高尔夫','golf','教练','coach'] },
  { name: '滑冰教练',       category: 'other',      tags: ['滑冰','skating','冰球','教练','coach'] },
  { name: '滑雪教练',       category: 'other',      tags: ['滑雪','skiing','教练','coach'] },
  { name: '舞蹈教练',       category: 'other',      tags: ['舞蹈','dance','跳舞','教练','老师'] },
  { name: '瑜伽教练',       category: 'other',      tags: ['瑜伽','yoga','教练','coach'] },
  { name: '健身教练',       category: 'other',      tags: ['健身','gym','fitness','私人教练','教练','personal trainer'] },
  { name: '武术教练',       category: 'other',      tags: ['武术','功夫','太极','教练','coach'] },
  { name: '跆拳道教练',     category: 'other',      tags: ['跆拳道','教练','coach','武术'] },
  { name: '驾照培训',       category: 'other',      tags: ['驾照','学车','G2','G牌','driving','教练','coach'] },
  // 专业服务
  { name: '英文翻译',       category: 'other',      tags: ['翻译','英文','口译','translation'] },
  { name: '中英翻译',       category: 'other',      tags: ['翻译','中文','英文','口译'] },
  { name: '法语翻译',       category: 'other',      tags: ['翻译','法语','french','口译'] },
  { name: '报税会计',       category: 'other',      tags: ['报税','会计','税务','tax','cpa'] },
  { name: '法律咨询',       category: 'other',      tags: ['律师','法律','咨询','legal'] },
  { name: '移民咨询',       category: 'other',      tags: ['移民','pr','签证','申请','咨询'] },
  { name: '保险服务',       category: 'other',      tags: ['保险','insurance','理赔','人寿'] },
  { name: '留学申请',       category: 'other',      tags: ['留学','申请','大学','移民','学校'] },
  { name: '房产中介',       category: 'other',      tags: ['房产','买房','卖房','租房','中介','realtor'] },
  { name: '贷款咨询',       category: 'other',      tags: ['贷款','mortgage','咨询','银行'] },
  // 生活服务
  { name: '摄影服务',       category: 'other',      tags: ['摄影','拍照','photography','婚礼'] },
  { name: '宠物照看',       category: 'other',      tags: ['宠物','狗','猫','寄养','pet','boarding'] },
  { name: '遛狗',           category: 'other',      tags: ['遛狗','dog walker','宠物','狗'] },
  { name: '美甲',           category: 'other',      tags: ['美甲','nail','指甲','美容'] },
  { name: '美发理发',       category: 'other',      tags: ['美发','理发','剪发','hair','发型'] },
  { name: '按摩推拿',       category: 'other',      tags: ['按摩','推拿','massage','理疗'] },
  { name: '针灸',           category: 'other',      tags: ['针灸','中医','acupuncture','理疗'] },
  { name: '网站开发',       category: 'other',      tags: ['网站','开发','设计','web','前端'] },
  { name: '电脑维修',       category: 'other',      tags: ['电脑','维修','手机','修复','it'] },
  { name: '室内设计',       category: 'other',      tags: ['室内','设计','装饰','interior'] },
  { name: '花园园艺',       category: 'other',      tags: ['花园','园艺','除草','landscaping','草坪'] },
  { name: '除雪服务',       category: 'other',      tags: ['除雪','铲雪','snow','冬天'] },
  { name: '婚庆策划',       category: 'other',      tags: ['婚庆','婚礼','策划','wedding'] },
  { name: '坐月子服务',     category: 'other',      tags: ['月子','产后','护理','月嫂'] },
  { name: '老人护理',       category: 'other',      tags: ['老人','护理','照顾','陪伴','elderly'] },
  { name: '儿童托管',       category: 'other',      tags: ['托管','儿童','孩子','babysitter','daycare'] },
  { name: '心理咨询',       category: 'other',      tags: ['心理','咨询','counseling','辅导'] },
  { name: '视频剪辑',       category: 'other',      tags: ['视频','剪辑','editing','后期','制作'] },
  { name: '平面设计',       category: 'other',      tags: ['设计','平面','graphic','logo','海报'] },
]

const MAIN_CAT_IDS = ['moving', 'cleaning', 'ride', 'renovation', 'cashwork']

const TORONTO_AREAS = [
  // ── Greater Toronto Area ──
  'Downtown Toronto 多伦多市中心',
  'North York 北约克',
  'Scarborough 士嘉堡',
  'Etobicoke 怡陶碧谷',
  'East York 东约克',
  'York 约克',
  'Markham 万锦',
  'Richmond Hill 列治文山',
  'Vaughan 万锦以北/旺市',
  'Mississauga 密西沙加',
  'Brampton 宾顿',
  'Oakville 奥克维尔',
  'Burlington 柏灵顿',
  'Milton 米尔顿',
  'Pickering 皮克灵',
  'Ajax 阿积士',
  'Whitby 惠特比',
  'Oshawa 奥沙华',
  'Newmarket 新市',
  'Aurora 奥罗拉',
  'King City 金城',
  'Stouffville 士多福维尔',
  'Georgina 乔治纳',
  'Caledon 卡利顿',
  'Halton Hills 哈顿山',
  'Innisfil 因尼斯菲尔',
  'Barrie 巴里',
  'Collingwood 科灵伍德',
  // ── 华人聚集区 ──
  'Agincourt 阿金科特',
  'Warden / Sheppard',
  'Kennedy / Finch',
  'Pacific Mall 太古广场',
  'First Markham Place 首都广场',
  // ── 南安省 ──
  'Hamilton 汉密尔顿',
  'Kitchener 基秦拿',
  'Waterloo 滑铁卢',
  'Cambridge 剑桥',
  'Guelph 圭尔夫',
  'London 伦敦市',
  'Windsor 温莎',
  'Niagara Falls 尼亚加拉瀑布',
  'St. Catharines 圣凯瑟琳斯',
  'Welland 韦兰',
  // ── 东安省 ──
  'Ottawa 渥太华',
  'Kingston 金斯顿',
  'Belleville 贝尔维尔',
  'Peterborough 彼得堡',
  'Cobourg 科堡',
  // ── 北安省 ──
  'Sudbury 萨德伯里',
  'Thunder Bay 桑德贝',
  'Sault Ste. Marie 苏圣玛丽',
  'North Bay 北湾',
  'Timmins 蒂明斯',
]

const INITIAL_FORM: PostServiceForm = {
  category: 'moving',
  title: '',
  description: '',
  price: '',
  priceType: 'hourly',
  name: '',
  phone: '',
  wechat: '',
  address: '',
  area: 'North York',
  tags: '',
}

export default function PostService() {
  const navigate = useNavigate()
  const fetchServices = useAppStore((s) => s.fetchServices)
  const user = useAuthStore((s) => s.user)
  const [form, setForm] = useState<PostServiceForm>(INITIAL_FORM)
  const [location, setLocation] = useState<LocationResult | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [errors, setErrors] = useState<Partial<PostServiceForm>>({})
  const [aiKeywords, setAiKeywords] = useState('')
  const [catSearch, setCatSearch]         = useState('')
  const [areaSearch, setAreaSearch]       = useState('')
  const [areaDropdownOpen, setAreaDropdownOpen] = useState(false)
  const [selectedAreas, setSelectedAreas] = useState<string[]>([])

  const HOT_AREAS = [
    'North York 北约克',
    'Markham 万锦',
    'Scarborough 士嘉堡',
    'Richmond Hill 列治文山',
    'Mississauga 密西沙加',
    'Downtown Toronto 多伦多市中心',
    'Vaughan 万锦以北/旺市',
  ]

  const toggleArea = (a: string) =>
    setSelectedAreas((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a])

  const confirmAreaInput = () => {
    const val = areaSearch.trim()
    if (!val) return
    if (!selectedAreas.includes(val)) setSelectedAreas((prev) => [...prev, val])
    setAreaSearch('')
    setAreaDropdownOpen(false)
  }

  const filteredAreas = areaSearch
    ? TORONTO_AREAS.filter((a) => a.toLowerCase().includes(areaSearch.toLowerCase()) && !selectedAreas.includes(a))
    : []
  const [dbServices, setDbServices] = useState<ServiceSuggestion[]>([])

  // Auto-fill contact fields from the user's saved profile
  useEffect(() => {
    if (!user) return
    supabase.from('users').select('name, phone, wechat').eq('id', user.id).single()
      .then(({ data }) => {
        if (!data) return
        setForm(prev => ({
          ...prev,
          name:   data.name  || prev.name,
          phone:  data.phone || prev.phone,
          wechat: data.wechat || prev.wechat || '',
        }))
      })
  }, [user])

  useEffect(() => {
    supabase.from('service_types').select('name, category_id').order('usage_count', { ascending: false }).limit(200)
      .then(({ data }) => {
        if (data) {
          setDbServices(data.map(r => ({
            name: r.name,
            category: (r.category_id ?? 'other') as ServiceCat,
            tags: [r.name],
          })))
        }
      })
  }, [])

  const ALL_SERVICES = [
    ...BUILTIN_SERVICES,
    ...dbServices.filter(d => !BUILTIN_SERVICES.some(b => b.name === d.name)),
  ]

  const [customCategory, setCustomCategory] = useState('')
  const [confirmedCustom, setConfirmedCustom] = useState('')

  const confirmCustom = () => {
    const val = customCategory.trim()
    if (!val) return
    setConfirmedCustom(val)
    setCustomCategory('')
    update('category', 'other')
    setTimeout(() => scrollTo(serviceInfoRef), 400)
  }
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const fileInputRef   = useRef<HTMLInputElement>(null)
  const serviceInfoRef = useRef<HTMLDivElement>(null)
  const contactRef     = useRef<HTMLDivElement>(null)
  const areaRef        = useRef<HTMLDivElement>(null)

  // Revoke blob URLs on unmount to avoid memory leaks
  useEffect(() => () => { previews.forEach(url => URL.revokeObjectURL(url)) }, [])

  const scrollTo = (ref: React.RefObject<HTMLDivElement>) => {
    setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const invalid = files.map(validateImageFile).filter(Boolean)
    if (invalid.length > 0) { toast(invalid[0] ?? '图片格式不支持', 'error'); e.target.value = ''; return }
    const remaining = 3 - images.length
    const toAdd = files.slice(0, remaining)
    setImages((prev) => [...prev, ...toAdd])
    setPreviews((prev) => [...prev, ...toAdd.map((f) => URL.createObjectURL(f))])
    e.target.value = ''
  }

  const handleImageRemove = (index: number) => {
    URL.revokeObjectURL(previews[index])
    setImages((prev) => prev.filter((_, i) => i !== index))
    setPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const update = (field: keyof PostServiceForm, value: string) => {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  const validate = () => {
    const errs: Partial<PostServiceForm> = {}
    if (!form.title.trim()) errs.title = '请填写服务标题'
    if (!form.description.trim()) errs.description = '请填写服务描述'
    if (!form.price.trim() && form.priceType !== 'negotiable') errs.price = '请填写价格'
    if (!form.name.trim()) errs.name = '请填写联系人姓名'
    if (!form.phone.trim()) {
      errs.phone = '请填写联系电话'
    } else if (!/^[\d\s\-+().]{7,20}$/.test(form.phone.trim())) {
      errs.phone = '请输入有效的电话号码（如：647-xxx-xxxx）'
    }
    return errs
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    if (!user) {
      navigate('/login')
      return
    }

    setIsSubmitting(true)
    setSubmitError('')
    try {
      // 1. Update user's contact info in users table
      const { error: upsertError } = await supabase.from('users').update({
        name: form.name.trim(),
        phone: form.phone.trim(),
        wechat: form.wechat?.trim() || null,
      }).eq('id', user.id)
      if (upsertError) throw upsertError

      // 2. Upload images to Supabase Storage (compress first if needed)
      const imageUrls: string[] = []
      const imageUploadErrors: string[] = []
      for (const file of images) {
        const compressed = await compressImage(file)
        const ext = compressed.name.split('.').pop()
        const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('service-images')
          .upload(path, compressed, { upsert: false })
        if (uploadError) {
          imageUploadErrors.push(file.name)
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('service-images')
            .getPublicUrl(path)
          imageUrls.push(publicUrl)
        }
      }

      // Build tags — include custom category label if applicable
      const baseTags = form.tags ? form.tags.split(/[,，\s]+/).filter(Boolean) : []
      const allTags = confirmedCustom
        ? [...baseTags, `类型:${confirmedCustom}`]
        : baseTags

      // 3. Insert service into Supabase
      const areaDisplay = selectedAreas.join('、') || 'Toronto'
      const { data: insertedService, error } = await supabase.from('services').insert({
        category_id: form.category,
        title: form.title.trim(),
        description: form.description.trim(),
        price: form.priceType === 'negotiable' ? 0 : parseFloat(form.price) || 0,
        price_type: form.priceType,
        address: location?.address ?? null,
        lat: (location?.lat != null && location?.lng != null && !(location.lat === 0 && location.lng === 0)) ? location.lat : null,
        lng: (location?.lat != null && location?.lng != null && !(location.lat === 0 && location.lng === 0)) ? location.lng : null,
        area: areaDisplay,
        service_areas: selectedAreas.length > 0 ? selectedAreas : ['Toronto'],
        city: 'Toronto',
        provider_id: user.id,
        tags: allTags,
        images: imageUrls,
        is_available: true,
        is_verified: false,
      }).select('id').single()

      if (error) throw error

      // 4. Save service type to crowd-sourced table
      const serviceTypeName = confirmedCustom || form.title.trim()
      if (serviceTypeName) {
        await supabase.from('service_types').upsert(
          { name: serviceTypeName, category_id: form.category, usage_count: 1 },
          { onConflict: 'name', ignoreDuplicates: true }
        )
      }

      const { data: followers } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('provider_id', user.id)

      if (insertedService?.id && followers?.length) {
        await Promise.all(
          followers.map((row: { follower_id: string }) =>
            notifyFollowerNewService({
              recipientUserId: row.follower_id,
              providerName: form.name.trim(),
              serviceTitle: form.title.trim(),
              serviceId: insertedService.id,
            })
          )
        )
      }

      if (imageUploadErrors.length > 0) {
        setSubmitError(`⚠️ 图片上传失败（${imageUploadErrors.join('、')}）— 请检查 Supabase Storage 权限设置，服务已发布但没有图片`)
        return   // 不跳转成功页，让用户看到错误
      }

      // 4. Refresh services list
      await fetchServices()
      setSubmitted(true)
    } catch (err: any) {
      setSubmitError(err?.message ?? '发布失败，请稍后重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="text-center"
        >
          <CheckCircle size={72} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">发布成功！</h2>
          <p className="text-gray-500 mb-8">您的服务已发布，附近的客户可以找到您了</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate('/')}
              className="btn-primary"
            >
              返回首页
            </button>
            <button
              onClick={() => {
                previews.forEach(url => URL.revokeObjectURL(url))
                setForm(INITIAL_FORM)
                setImages([])
                setPreviews([])
                setSelectedAreas([])
                setConfirmedCustom('')
                setSubmitted(false)
              }}
              className="text-gray-500 text-sm underline"
            >
              继续发布服务
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <Header />

      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate(-1)} className="text-gray-500">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">发布服务</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">服务类型 *</h3>

            {/* Search */}
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={catSearch}
                onChange={(e) => setCatSearch(e.target.value)}
                placeholder="搜索服务类型，如：钢琴教学、报税..."
                className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
              />
              {catSearch && (
                <button type="button" onClick={() => setCatSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Confirmed custom tag */}
            {confirmedCustom && (
              <div className="flex flex-wrap gap-2 mb-3">
                <button type="button" onClick={() => update('category', 'other')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-xs font-medium transition-all ${
                    form.category === 'other'
                      ? 'border-primary-500 bg-primary-50 text-primary-600'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {confirmedCustom}
                  <span onClick={(e) => { e.stopPropagation(); setConfirmedCustom(''); update('category', 'moving') }}
                    className="text-gray-400 hover:text-red-400 leading-none">✕</span>
                </button>
              </div>
            )}

            {/* Search results — shown when typing */}
            {catSearch && (() => {
              const q = catSearch.toLowerCase()
              const results = ALL_SERVICES.filter(s =>
                s.name.includes(catSearch) || s.tags.some(t => t.includes(q))
              ).slice(0, 12)
              return results.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-3">
                  {results.map(s => {
                    const cat = CATEGORIES.find(c => c.id === s.category)
                    const isSelected = confirmedCustom === s.name
                    return (
                      <button key={s.name} type="button"
                        onClick={() => {
                          if (MAIN_CAT_IDS.includes(s.category)) {
                            setConfirmedCustom('')
                            update('category', s.category)
                          } else {
                            setConfirmedCustom(s.name)
                            update('category', s.category)
                          }
                          setCatSearch('')
                          scrollTo(serviceInfoRef)
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                          isSelected
                            ? 'border-primary-500 bg-primary-50 text-primary-600'
                            : `border-gray-200 bg-white text-gray-700 hover:border-primary-300 hover:text-primary-600 ${cat?.bgColor ?? ''}`
                        }`}
                      >
                        {s.name}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400 mb-3">没有找到，可在「其他服务」里自定义</p>
              )
            })()}

            {/* 6-grid — hidden when searching */}
            {!catSearch && (
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.filter(cat => MAIN_CAT_IDS.includes(cat.id)).map((cat) => (
                  <button key={cat.id} type="button"
                    onClick={() => { setConfirmedCustom(''); update('category', cat.id); scrollTo(serviceInfoRef) }}
                    className={`flex flex-col items-center gap-1 sm:gap-1.5 py-2 sm:p-3 rounded-xl border-2 transition-all ${
                      form.category === cat.id && !confirmedCustom
                        ? `border-primary-500 ${cat.bgColor}`
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <img src={cat.image} alt={cat.postLabel} className="hidden sm:block w-8 h-8 object-contain" />
                    <span className={`text-xs font-medium ${form.category === cat.id && !confirmedCustom ? cat.color : 'text-gray-600'}`}>
                      {cat.postLabel}
                    </span>
                  </button>
                ))}
                <button type="button" onClick={() => update('category', 'other')}
                  className={`flex flex-col items-center gap-1 sm:gap-1.5 py-2 sm:p-3 rounded-xl border-2 transition-all ${
                    form.category === 'other' && !confirmedCustom
                      ? 'border-primary-500 bg-gray-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <span className="hidden sm:block text-2xl">＋</span>
                  <span className={`text-xs font-medium ${form.category === 'other' && !confirmedCustom ? 'text-primary-600' : 'text-gray-600'}`}>
                    其他服务
                  </span>
                </button>
              </div>
            )}

            {/* Custom category input — shown when 其他 selected and not yet confirmed */}
            {form.category === 'other' && !confirmedCustom && (
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), confirmCustom())}
                  placeholder="例：钢琴教学、翻译"
                  autoFocus
                  className="flex-1 px-4 py-2.5 text-sm border border-primary-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={confirmCustom}
                  className="px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors flex-shrink-0"
                >
                  确认
                </button>
              </div>
            )}
          </div>

          {/* Service info */}
          <div ref={serviceInfoRef} className="card p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-700">服务信息</h3>
              <button
                type="button"
                onClick={async () => {
                  setAiGenerating(true)
                  const draft = await generateServiceDraft({
                    categoryId: form.category,
                    title: form.title,
                    keywords: `${aiKeywords}\n${form.tags}`.trim(),
                    serviceAreas: selectedAreas,
                    priceType: form.priceType,
                    imageCount: images.length,
                  })
                  setAiGenerating(false)
                  if (!draft) {
                    setSubmitError('AI 文案生成失败，请稍后再试')
                    return
                  }
                  setForm((prev) => ({
                    ...prev,
                    title: draft.title || prev.title,
                    description: draft.description || prev.description,
                    tags: draft.tags.length ? draft.tags.join(' ') : prev.tags,
                  }))
                }}
                disabled={aiGenerating}
                className="text-xs font-semibold px-3 py-1.5 rounded-full bg-primary-50 text-primary-600 hover:bg-primary-100 disabled:opacity-60 transition-colors"
              >
                {aiGenerating ? 'AI 生成中…' : 'AI 辅助写文案'}
              </button>
            </div>

            <Field label="AI 关键词">
              <input
                className="input-base"
                value={aiKeywords}
                onChange={(e) => setAiKeywords(e.target.value)}
                placeholder="例：家里漏水、北约克、10年经验、可上门急修"
              />
              <p className="text-xs text-gray-400 mt-1">可结合已选图片数量、分类和区域生成更自然的服务标题与描述</p>
            </Field>

            <Field label="服务标题" required error={errors.title}>
              <input
                className="input-base"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="例：多伦多本地搬家服务，有货车"
                maxLength={50}
              />
            </Field>

            <Field label="服务描述" required error={errors.description}>
              <textarea
                className="input-base resize-none"
                rows={4}
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="详细描述您的服务内容、经验、注意事项等..."
                maxLength={500}
              />
              <p className="text-xs text-gray-400 text-right mt-0.5">{form.description.length}/500</p>
            </Field>

            {/* Images */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                服务图片 <span className="text-gray-400 font-normal">（最多 3 张）</span>
              </label>
              <div className="flex gap-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleImageRemove(i)}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
                {images.length < 3 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-primary-400 hover:text-primary-500 transition-colors flex-shrink-0"
                  >
                    <ImagePlus size={22} />
                    <span className="text-xs">{previews.length === 0 ? '添加图片' : '继续添加'}</span>
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageAdd}
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">价格 *</label>
              <div className="flex gap-2">
                <div className="flex rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
                  {[
                    { v: 'hourly', l: '时薪' },
                    { v: 'fixed', l: '固定价' },
                    { v: 'negotiable', l: '面议' },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => update('priceType', opt.v)}
                      className={`px-3 py-2 text-xs font-medium transition-colors ${
                        form.priceType === opt.v
                          ? 'bg-primary-600 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
                {form.priceType !== 'negotiable' && (
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      className="input-base pl-7"
                      value={form.price}
                      onChange={(e) => update('price', e.target.value.replace(/[^0-9.]/g, ''))}
                      placeholder="0.00"
                      type="number"
                      min="0"
                    />
                  </div>
                )}
              </div>
              {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price}</p>}
            </div>

            <Field label="标签（用逗号分隔）">
              <input
                className="input-base"
                value={form.tags}
                onChange={(e) => update('tags', e.target.value)}
                onBlur={() => scrollTo(contactRef)}
                placeholder="例：本地搬家, 打包服务, 有货车"
              />
            </Field>
          </div>

          {/* Contact */}
          <div ref={contactRef} className="card p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">联系方式</h3>

            <Field label="联系人姓名" required error={errors.name}>
              <input
                className="input-base"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="您的称呼"
              />
            </Field>

            <Field label="联系电话" required error={errors.phone}>
              <input
                className="input-base"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="647-xxx-xxxx"
                type="tel"
              />
            </Field>

            <Field label="微信号（可选）">
              <input
                className="input-base"
                value={form.wechat}
                onChange={(e) => update('wechat', e.target.value)}
                onBlur={() => scrollTo(areaRef)}
                placeholder="您的微信号"
              />
            </Field>

            <Field label="所在位置（选填）">
              <LocationInput onChange={setLocation} />
              <p className="text-xs text-amber-600 mt-2">
                未定位时会显示服务区域，但不会出现在精确地图点位中。
              </p>
            </Field>
          </div>

          {/* Area */}
          <div ref={areaRef} className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">服务区域</h3>

            {/* Search input + selected tags inline */}
            <div className="flex flex-wrap items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-primary-400 focus-within:border-transparent bg-white mb-3 relative">
              {selectedAreas.map((a) => (
                <span key={a} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-50 border border-primary-300 text-primary-600 text-xs font-medium flex-shrink-0">
                  {a}
                  <button type="button" onClick={() => toggleArea(a)} className="text-primary-400 hover:text-red-400">
                    <X size={10} />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={areaSearch}
                onChange={(e) => { setAreaSearch(e.target.value); setAreaDropdownOpen(true) }}
                onFocus={() => setAreaDropdownOpen(true)}
                onBlur={() => setTimeout(() => setAreaDropdownOpen(false), 150)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), confirmAreaInput())}
                placeholder={selectedAreas.length === 0 ? '搜索或输入区域，Enter 确认...' : '继续添加...'}
                className="flex-1 min-w-[120px] text-sm outline-none bg-transparent"
              />

              {/* Dropdown */}
              {areaDropdownOpen && filteredAreas.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
                  {filteredAreas.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { toggleArea(a); setAreaSearch(''); setAreaDropdownOpen(false) }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-600 transition-colors"
                    >
                      {a}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Hot areas */}
            <p className="text-xs text-gray-400 mb-2">热门地区</p>
            <div className="flex flex-wrap gap-2">
              {HOT_AREAS.map((a) => {
                const selected = selectedAreas.includes(a)
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleArea(a)}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                      selected
                        ? 'bg-primary-50 border-primary-400 text-primary-600'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {a}
                  </button>
                )
              })}
            </div>
          </div>

          {submitError && (
            <p className="text-sm text-red-500 text-center">{submitError}</p>
          )}

          <motion.button
            type="submit"
            disabled={isSubmitting}
            whileTap={{ scale: isSubmitting ? 1 : 0.97 }}
            className="w-full btn-primary py-4 text-base rounded-2xl disabled:opacity-60"
          >
            {isSubmitting ? '发布中...' : '免费发布服务'}
          </motion.button>

          <p className="text-xs text-center text-gray-400">
            发布即表示您同意平台服务条款，内容须合法合规
          </p>
        </form>
      </div>
    </div>
  )
}

// ── Sub-components (defined outside to prevent remount on every render) ───────
function Field({
  label, required, error, children,
}: {
  label: string; required?: boolean; error?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
