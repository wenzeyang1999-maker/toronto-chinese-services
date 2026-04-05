// ─── Seed Data ────────────────────────────────────────────────────────────────
// Realistic-looking content for cold-start. All posted by the seed account.

const SERVICES = [
  {
    title: '专业家居清洁服务 | North York / Markham',
    description: '提供住宅深度清洁、日常维护清洁、搬入搬出清洁。持有商业清洁保险，使用环保清洁产品。服务区域：North York、Markham、Scarborough。可按次或按月预约。',
    category_id: 'cleaning',
    price: 120, price_type: 'fixed',
    area: 'North York',
  },
  {
    title: '本地搬家服务 大小搬家 钢琴搬运',
    description: '多伦多本地搬家，拥有自己的搬家卡车，团队经验丰富。提供打包、装卸、长途搬运服务。钢琴/重型家具专项搬运。按小时收费，无隐藏费用。',
    category_id: 'moving',
    price: 85, price_type: 'hourly',
    area: 'Greater Toronto Area',
  },
  {
    title: '持牌电工 | 装修/维修/新装插座',
    description: '安大略持牌电工，承接住宅和商业电气工程。新装插座、灯具安装、电路维修、配电箱升级。提供免费上门估价，工程结束后出具正式发票。',
    category_id: 'renovation',
    price: 95, price_type: 'hourly',
    area: 'Mississauga',
  },
  {
    title: '中文移民律师 | 工签/PR/入籍全程服务',
    description: '执照移民顾问（RCIC），专注工作签证、枫叶卡申请、入籍服务。中英文服务，免费30分钟电话咨询。成功案例500+，客户遍布安省。',
    category_id: 'legal',
    price: 200, price_type: 'hourly',
    area: 'Downtown Toronto',
  },
  {
    title: '中文会计/报税 个人/小企业 CPA',
    description: 'CPA持证会计师，专业处理个人报税、小企业财务、HST申报、工资单处理。中英文双语，全年服务。报税季特惠：个人税$80起。',
    category_id: 'finance',
    price: 80, price_type: 'fixed',
    area: 'Markham',
  },
  {
    title: '房屋装修翻新 厨房/卫生间/地板',
    description: '专业装修团队，承接厨房翻新、卫生间改造、地板铺设、墙面粉刷。材料工艺均提供质保。提供3D效果图，先看效果再施工。免费上门量尺报价。',
    category_id: 'renovation',
    price: null, price_type: 'quote',
    area: 'Scarborough',
  },
  {
    title: '私人补习 | 数学/物理/化学 Grade 9-12',
    description: '麦克马斯特大学理工科毕业，专注高中理科补习。一对一或小班授课，帮助学生提升成绩、备考EQAO/大学申请。上门或线上均可，灵活安排时间。',
    category_id: 'education',
    price: 45, price_type: 'hourly',
    area: 'Hamilton',
  },
  {
    title: '中餐外卖配送 North York区域',
    description: '专业送餐员，服务North York中餐馆。熟悉本地路况，准时送达。可承接餐馆合作，按单计费。已在平台稳定接单2年+，信誉保障。',
    category_id: 'delivery',
    price: 6, price_type: 'fixed',
    area: 'North York',
  },
  {
    title: '宠物寄养/遛狗 | 家庭环境 Markham',
    description: '爱狗人士，家有大院，提供家庭式宠物寄养服务。每日发送照片视频，让您放心。遛狗服务每次45分钟。仅接受小型犬和中型犬，名额有限。',
    category_id: 'pets',
    price: 40, price_type: 'daily',
    area: 'Markham',
  },
  {
    title: '汽车维修保养 | 华人师傅 价格实惠',
    description: '持牌汽车技师，15年维修经验。换机油、刹车、轮胎、发动机维修均可。同类型4S店价格的6折，品质不打折。提供免费检测，修不好不收费。',
    category_id: 'automotive',
    price: 50, price_type: 'fixed',
    area: 'Brampton',
  },
  {
    title: '摄影服务 | 证件照/全家福/商品拍摄',
    description: '专业摄影师，提供证件照、家庭合影、商品电商摄影。自备摄影棚，也可上门拍摄。照片当天出样，修图精细。微信预约享9折优惠。',
    category_id: 'photography',
    price: 150, price_type: 'fixed',
    area: 'Downtown Toronto',
  },
  {
    title: '管道维修 | 水管漏水/马桶/热水器',
    description: '持牌水管工，24小时紧急上门。漏水检测、马桶维修、热水器安装、厨卫管道疏通。收费透明，修好才付款。安省服务区域：大多地区均可上门。',
    category_id: 'plumbing',
    price: 80, price_type: 'hourly',
    area: 'Greater Toronto Area',
  },
]

const JOBS = [
  {
    title: '中餐厅招厨师/帮厨 Markham',
    description: '本店为Markham知名中餐馆，现招聘有经验厨师1名、帮厨2名。要求：有相关经验，勤奋踏实。提供员工餐，正式员工享受牙科保险。有意者请直接联系。',
    listing_type: 'hiring',
    job_type: 'fulltime',
    category: 'restaurant',
    salary_min: 3500, salary_max: 5000, salary_type: 'monthly',
    area: 'Markham',
    contact_name: '王经理', contact_phone: '',
  },
  {
    title: '超市收银员/理货员 Part-time',
    description: '华人超市招收银员和理货员，兼职，周末必须有空。无经验可培训，中文环境，工作轻松。每周16-24小时，按时发薪。',
    listing_type: 'hiring',
    job_type: 'parttime',
    category: 'retail',
    salary_min: 17, salary_max: 19, salary_type: 'hourly',
    area: 'Scarborough',
    contact_name: '李店长', contact_phone: '',
  },
  {
    title: '求职：IT工程师 寻全职机会',
    description: '计算机科学硕士，5年软件开发经验，熟悉React/Node.js/Python。曾就职于国内互联网公司，现持工签在多伦多寻找IT全职机会。可提供英文简历和推荐信。',
    listing_type: 'seeking',
    job_type: 'fulltime',
    category: 'tech',
    salary_min: 80000, salary_max: 110000, salary_type: 'yearly',
    area: 'Toronto',
    contact_name: '张同学', contact_phone: '',
  },
]

const COMMUNITY_POSTS = [
  {
    type: 'recommend',
    area: 'markham',
    title: '求推荐 Markham 附近靠谱的家庭医生',
    content: '刚搬到Markham，还没找到家庭医生。有人能推荐吗？最好能说中文，方便沟通。现在很多诊所都不接新病人了，有点着急。',
  },
  {
    type: 'experience',
    area: 'north_york',
    title: '分享：用这个平台找到靠谱搬家师傅的经历',
    content: '上个月搬家，在平台上找了一家搬家公司，价格合理，师傅很专业，钢琴也搬得很好。整个过程没有任何问题，强烈推荐大家用这个平台找服务，比Facebook群里靠谱多了。',
  },
  {
    type: 'question',
    area: 'other',
    title: '安省驾照换本地驾照需要什么材料？',
    content: '我拿的是中国驾照，来加拿大有半年了。听说可以直接换G牌，但不知道具体需要哪些材料，是否需要笔试路试？有过来人分享一下经验吗？',
  },
  {
    type: 'experience',
    area: 'mississauga',
    title: 'Mississauga 华人超市价格对比（2026年4月）',
    content: 'T&T、大统华、丰泰、99Ranch都逛过了，总结一下：蔬菜类99Ranch最便宜；海鲜T&T品质最好；日用品大统华性价比高。供大家参考，欢迎补充！',
  },
  {
    type: 'question',
    area: 'toronto',
    title: '多伦多报税问题：海外收入需要申报吗？',
    content: '今年是我来加拿大第一年，还有国内的一些投资收益，请问这部分需要在加拿大申报吗？会被双重征税吗？有没有懂这方面的朋友或者会计师解答一下？',
  },
  {
    type: 'recommend',
    area: 'scarborough',
    title: '求推荐 Scarborough 好吃的川菜馆',
    content: '最近特别想吃正宗川菜，麻辣火锅或者干锅都行。Scarborough这边有没有口味正宗、价格不太贵的川菜馆？最好环境也还不错，带朋友去吃的。',
  },
  {
    type: 'secondhand',
    area: 'north_york',
    title: '转让：IKEA 书桌+椅子 九成新 North York自取',
    content: 'IKEA MICKE书桌（白色）加配套椅子，购入一年，整体九成新，无明显划痕。因换工作不需要居家办公了，便宜出。North York自取，价格可小刀。',
  },
]

module.exports = { SERVICES, JOBS, COMMUNITY_POSTS }
