# TCS Launch Kit

启动工具包，与主应用代码分离。

## 文件结构

```
launch/
├── README.md              # 本文件
├── .env.example           # 环境变量模板
├── seed/
│   ├── seed.js            # A. 种子数据脚本（一键填充测试内容）
│   └── seed-data.js       # 种子数据内容
├── seo/
│   ├── generate-sitemap.js # B. 自动生成 sitemap.xml
│   └── robots.txt         # 复制到 public/
├── email/
│   └── welcome-trigger.sql # D. 新用户欢迎邮件 DB trigger
└── copy/
    └── templates.md       # C. 推广文案模板（小红书/微信/Facebook）
```

## 快速开始

```bash
cd launch
cp .env.example .env      # 填入你的 Supabase service_role key
npm install               # 安装依赖
node seed/seed.js         # 运行种子数据
node seo/generate-sitemap.js  # 生成 sitemap
```
