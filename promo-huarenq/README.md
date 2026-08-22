# huarenq.* 宣传落地页

给 `huarenq.com` / `huarenq.net` / `huarenq.ca` 三个域名用的**单文件静态宣传页**。
主 CTA 指向 `hualinlife.com`,含一个可替换的广告位。

- 单文件、零依赖、自适应、明暗双主题。就 `index.html` 一个文件。

## 怎么上线(推荐:新建一个 Vercel 静态项目,和主站分开)
1. Vercel → New Project → 选同一个 Git 仓库。
2. **Root Directory** 设为 `promo-huarenq`;Framework Preset 选 **Other**(纯静态,无需 build)。
3. 部署后进该项目 → Settings → Domains,把 `huarenq.com`、`www.huarenq.com`、`huarenq.net`、`huarenq.ca` 都加进来。
4. 去 Porkbun 把这三个域名的 DNS 按 Vercel 提示改成指向 Vercel(A / CNAME),**关掉 Porkbun 的 URL 转发/停放**。
   > 注意:这和主站 `hualinlife.com` 是**各自独立**的域名与项目,互不影响。

> 或者更省事:把 `index.html` 直接拖到 Vercel/Netlify 的 drop 部署,再绑这三个域名。

## 改广告
打开 `index.html`,搜 `<!-- 广告位` 那段(`.ad` 卡片),换成你的广告主内容即可;
要接 Google AdSense 就把那张卡换成 AdSense 给的 `<ins class="adsbygoogle">…</ins>` 代码块
(注意 AdSense 需要它的脚本,静态托管可以直接加 `<script>`)。

## 备注
- 现在 CTA 链接是 `https://hualinlife.com` —— 该域名 DNS 切到 Vercel 生效后才打得开;
  在那之前想让按钮先能用,可临时把链接换成主站现址 `https://toronto-chinese-services.vercel.app`。
