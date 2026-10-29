# নিজে deployment করার নির্দেশনা

আপনি বন্ধ করতে না বলা পর্যন্ত Codex app update-এর পরে প্রয়োজনীয় deployment ও live verification করে দেবে। এই নির্দেশনাটি নিজে শেখা ও প্রয়োজনে কাজ করার জন্য।

## আপনার তিনটি service

| অংশ | কোথায় | কী কাজ করে |
| --- | --- | --- |
| Website | [Vercel project](https://vercel.com/asad-6810/tech-trolley-internal) | দোকানের screen ও browser-এর `/api` proxy |
| Backend/API | [Render service](https://dashboard.render.com/web/srv-dbhqf66gekts73bv6phg) | Login, stock, হিসাব, permission |
| Database | [Supabase project](https://supabase.com/dashboard/project/iejosjzhjjeykxknbxdw) | সংরক্ষিত হিসাব ও stock |

ব্যবহার করার স্থায়ী link: **https://tech-trolley-internal.vercel.app/**। Vercel-এর প্রতিবারের preview/deployment URL ব্যবহার করবেন না; সেগুলো app-এর production write origin নয়।

## ১. নতুন code GitHub-এ দিন

Codex ইতিমধ্যে commit/push করলে এই অংশ আবার লাগবে না। নিজের হাতে code পাল্টালে PowerShell-এ:

```powershell
Set-Location E:\Taki
git branch --show-current
git status --short
```

এই project-এর production branch **`codex/tech-trolley-production`**। কেবল নিজের পরিবর্তিত source file-গুলো stage করুন:

```powershell
git add path/to/changed-file
git diff --cached
git commit -m "Describe the update"
git push origin codex/tech-trolley-production
git rev-parse --short HEAD
```

`path/to/changed-file` জায়গায় নিজের বদলানো file-এর path লিখবেন; এটি হুবহু চালানোর command নয়। `.env`, password বা `.local`-এর private file stage করবেন না। [GitHub Actions](https://github.com/asadbinjafor/TECH-TROLLY/actions)-এ সর্বশেষ একই commit-এর **Verify** সবুজ হয়েছে কি না দেখুন।

## ২. Vercel: website update

1. উপরের Vercel project খুলুন → **Deployments**।
2. এই branch-এ push করলে বর্তমানে Vercel নিজে build শুরু করে। নতুন commit-এর deployment **Ready** এবং Production/Current হয়েছে কি না দেখুন।
3. Environment variable পাল্টানোর পরে বা পুরোনো build আবার চালাতে চাইলে সঠিক deployment-এর **… → Redeploy** ব্যবহার করুন। নতুন source code আগে GitHub-এ push করতে হবে; পুরোনো deployment Redeploy করলে সেই পুরোনো source-ই আবার build হয়।
4. নতুন deployment-এর commit GitHub-এর সর্বশেষ commit-এর সঙ্গে মিলিয়ে নিন। **Visit** দিয়ে উপরের স্থায়ী website খুলে refresh করুন।

বর্তমান root directory `tech-trolley-frontend`; browser API `/api`; server-only upstream `https://tech-trolley-internal-api.onrender.com`। সাধারণ update-এ এই settings পাল্টাতে হয় না।

## ৩. Render: API update

Backend, shared API contract বা database migration বদলালে এই অংশও করুন। কেবল website-এর CSS/screen বা browser startup বদলালে API একই থাকতে পারে। Render-এর auto deploy বর্তমানে **Off**।

1. উপরের Render service খুলুন। নাম **tech-trolley-internal-api** কি না মিলিয়ে নিন।
2. **Manual Deploy → Deploy latest commit** চাপুন।
3. **Source**-এ নতুন commit এসেছে কি না দেখুন। আগে থেকেই দেখানো পুরোনো green Live-কে নতুন deployment-এর ফল ধরে নেবেন না।
4. **Build successful**, তারপর **Deploy succeeded | Live** হওয়া পর্যন্ত অপেক্ষা করুন।
5. Logs-এ failure থাকলে error দেখে সমাধান করুন। নতুন migration থাকলে normal startup সেটি একবার apply করে; পুরোনো হিসাব reset করে না।

বর্তমান commands:

```text
Build: npm ci --include=dev && npm run build:api
Start: npm run start:render
Health: /health
Branch: codex/tech-trolley-production
Root Directory: blank
```

## ৪. Supabase: কখন কাজ করতে হবে

সাধারণ UI/code update-এ Supabase-এ আলাদা Deploy বোতাম চাপতে হয় না। `migrations/`-এ নতুন versioned SQL file থাকলে Render-এর normal startup runner তা apply করে। SQL Editor থেকে আবার একই migration চালানো, table reset করা বা sample transaction ঢোকানোর প্রয়োজন নেই। Production database-এ `npm test` চালাবেন না।

অনেক দিন ব্যবহার না করার পরে project **Paused** দেখালে Supabase dashboard থেকে **Restore** করে **Healthy** হওয়া পর্যন্ত অপেক্ষা করুন। তারপর website খুলুন; API যদি পুনরায় চালু না হয়, Render-এর **Manual Deploy → Restart service** দিয়ে চালু করুন। [Supabase-এর inactivity policy](https://supabase.com/docs/guides/deployment/going-into-prod#availability)।

## ৫. সবশেষে কীভাবে নিশ্চিত হবেন

1. [Website](https://tech-trolley-internal.vercel.app/) খুলুন। Startup screen এলে সেটি খোলা রাখুন; server/database প্রস্তুত হলে login/dashboard নিজে থেকে আসবে।
2. [Web API health](https://tech-trolley-internal.vercel.app/api/health) এবং [Render health](https://tech-trolley-internal-api.onrender.com/health) প্রস্তুত অবস্থায় `{"status":"ok"}` দেবে।
3. নিজের account দিয়ে login করে dashboard, stock ও প্রয়োজনীয় report দেখুন। শুধু পরীক্ষা করার জন্য আসল shop-এ নকল sale/খরচ post করবেন না।
4. Website-এ আগের screen থাকলে refresh করুন। Build/Live/health/ব্যবহার—সব ধাপ মিললেই update শেষ।

## Sleep ও অপেক্ষার screen

Render Free-তে ১৫ মিনিট inbound traffic না থাকলে service sleep করে; পরের request সেটি চালু করে এবং প্রায় এক মিনিট লাগতে পারে। [Render-এর নিয়ম](https://render.com/docs/free#spinning-down-on-idle)।

Website-এর public screen আগে থেকেই তৈরি static HTML হিসেবে আসে। এরপর database-backed health পরীক্ষা করা হয়। সংযোগের সময় animation, সত্যিকারের অপেক্ষার সময় ও ধাপ দেখা যায়; server প্রস্তুত হলে app নিজে থেকেই এগোয়। Read-only health probe সর্বোচ্চ দুই মিনিট চেষ্টা করে, মাঝে বিরতি বাড়ায়। সংযোগ না হলে স্পষ্ট Retry দেখায়; internet ফিরে এলে আবার চেষ্টা করে। Sale/খরচের POST automatic replay হয় না; কোনো submission uncertain হলে আগের একই key-এর status/retry ব্যবহার করুন।

Render service-এর paid compute plan-এ এই idle spin-down থাকে না; workspace plan upgrade আলাদা বিষয়। Supabase Free project সাত দিনের কম activity-তেও pause হতে পারে এবং dashboard restore লাগতে পারে। Paid Render compute এবং Supabase Pro এই দুই inactivity সীমার সংশ্লিষ্ট সমাধান; plan ও খরচ Owner বেছে নেবেন। Animation কোনো provider outage, suspended account বা paused database নিজে থেকে ঠিক করতে পারে না।

## ভুল deployment হলে

নতুন deployment-এর logs ও commit আগে মিলিয়ে দেখুন। Vercel-এর working deployment-এ rollback এবং Render-এর working commit-এ redeploy/rollback করা যায়। Code rollback database migration undo করে না—database table মুছবেন না। Schema বদল থাকলে কোন API/web version একসঙ্গে compatible তা দেখে fix/release করুন। পূর্ণ hosting setup ও backup-এর জন্য [deployment guide](deploy-vercel-render-supabase-bn.md) দেখুন।
