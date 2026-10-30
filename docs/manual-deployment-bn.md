# নিজে deployment করার নির্দেশনা

**Android/iPhone ও RAM/Storage update (৩১ অক্টোবর):** New purchase ও ব্যক্তির কাছ থেকে ক্রয়ে ফোনের ধরন বাছুন; আসল Model নামও লিখবেন। Android হলে RAM 4/8/12/16 GB এবং Storage 64/128/256/512 GB বা 1/2 TB বাছুন। iPhone হলে RAM লাগবে না। New sale-এ এই বাছাইগুলো দিয়ে stock খুঁজবেন; নির্দিষ্ট stock বাছলে তার তথ্য আসবে। পুরোনো stock-এর ধরন দেওয়া না থাকলে Phone type খালি রেখে সেটি বাছুন, অথবা Inventory → Edit stock details দিয়ে সঠিক ধরন/RAM/Storage দিন। অনুমান করে পুরোনো তথ্য বদলানো হয়নি।

এই update-এ migration **010_phone_type_and_ram.sql** আছে। স্বাভাবিক Git push → CI pass → Render startup runner সেটি চালাবে; তখন মোট **১০টি migration**, আগের মতো **১৯টি RLS table** থাকবে। Supabase-এ হাতে SQL/reset নয়। Release-এর পরে `/api/health` revision ও live ফল পরীক্ষা করবেন।

**একসঙ্গে release live হয়েছে (৩১ অক্টোবর):** নতুন seller form/PDF পরিবর্তনের সঙ্গে মোবাইল login zoom ও PDF Download feedback-এর fix প্রকাশ হয়েছে, commit `0d0bc99`। [সফল CI](https://github.com/asadbinjafor/TECH-TROLLY/actions/runs/41115047376), Vercel ও Render-এর একই API revision যাচাই হয়েছে। Download চাপলে progress দেখাবে; PDF প্রস্তুত হলে প্রয়োজনমতো **ফাইল সেভ করুন** চাপবেন। Purchases-এ **নমুনা A4 ফর্ম** থেকেও sample পাওয়া যাবে। নতুন migration লাগেনি; মোট ৯টি migration-ই আছে। পুরোনো হিসাব ও journal মিলেছে; পরীক্ষামূলক production কেনাবেচা করা হয়নি। নিচের Git → CI → Vercel/Render পদ্ধতিতেই ভবিষ্যৎ release করবেন।

ব্যক্তির কাছ থেকে ফোন ক্রয় / পরিচয় / এক পৃষ্ঠার A4 ক্রয়পত্র update-এর deployment অনুমোদিত। পরীক্ষিত পরিবর্তন `codex/tech-trolley-production`-এ push করলে নিচের স্বাভাবিক automatic deployment চলবে। নতুন migration **009** Render-এর স্বাভাবিক startup runner চালাবে; পুরোনো আটটি migration অক্ষত থাকবে। Supabase reset বা হাতে SQL চালাবেন না।

এই update এখন live: feature commit `c058300`, [সফল CI verification](https://github.com/asadbinjafor/TECH-TROLLY/actions/runs/41109102107)। [কেনাকাটা পাতা](https://tech-trolley-internal.vercel.app/purchases) খুলে refresh দিন। Vercel/Render স্বয়ংক্রিয় deployment ও migration 009 যাচাই হয়েছে; আগের হিসাব backup-এর সঙ্গে মিলেছে।

নতুন release-এর পর CI ও `/api/health`-এ প্রত্যাশিত API revision মিলিয়ে নিশ্চিত হবেন। এই release-এ মোট **৯টি migration** ও **১৯টি RLS-সুরক্ষিত app table** হবে। শুধু docs-এর শেষ commit দিয়ে API roll-out হয়েছে ধরে নেবেন না। Dashboard-এর Manual Deploy সাধারণ update-এর জন্য লাগবে না।

ব্যবহার: **কেনাকাটা → ব্যক্তির কাছ থেকে ফোন ক্রয়**। সরাসরি বিক্রেতার পরিচয় লিখুন; আলাদা seller নির্বাচন লাগবে না। NID-এর পাশে জন্মতারিখ দিন। স্থায়ী ঠিকানা ঐচ্ছিক; বাকি পরিচয় যাচাই করে পূরণ করুন। ফোনের তথ্য ও বক্সসহ/বক্স ছাড়া বাছুন। শুধু বাস্তবে দেওয়া Cash/Bank লিখুন; অব্যবহৃত ঘর খালি থাকবে। Review-তে মোট/বাকি মিলিয়ে নিশ্চিত করুন। Save-এর পরে **ফোন ক্রয়পত্র → PDF খুলুন / প্রিন্ট** থেকে A4, Actual size / 100% দিয়ে এক পৃষ্ঠা প্রিন্ট নিন। দুইটি স্বাক্ষর হাতে দেবেন। পরে Purchases-এর Details থেকে একই মূল ক্রয়পত্র আবার খুলতে পারবেন। পরের বাকি পরিশোধ বা Stock Edit মূল স্বাক্ষরিত তথ্য বদলাবে না; লেনদেনের history-তে থাকবে।

বিক্রেতাকে দেওয়ার বাকি থাকলে **টাকা ও বাকি → Supplier-কে বাকি পরিশোধ** থেকে মূল ক্রয়টি বেছে বাস্তব পেমেন্ট দিন। Personal DUE / ধার-পাওনা এখানে ব্যবহার করবেন না। একই ফোন আগে বিক্রি হয়ে থাকলে আবার নতুন purchase হবে; পুরোনো লাভ/ইতিহাস মুছবে না। একই IMEI ইতিমধ্যে stock-এ থাকলে দ্বিতীয়বার যোগ বন্ধ থাকবে।

Migration 009-এর পরে একই ফোনের নতুন ক্রয়চক্র তৈরি হলে আগের API version-এ সরাসরি rollback করবেন না—সেটি নতুন history ও reversal guard বোঝে না। প্রয়োজন হলে যাচাই করা নতুন fix দিয়ে recovery করতে হবে।

DUE / ধার-পাওনা update এখন live: feature commit `dbd6d6f`, [CI verification](https://github.com/asadbinjafor/TECH-TROLLY/actions/runs/41091347037) পাস। [DUE পাতা](https://tech-trolley-internal.vercel.app/dues) খুলে refresh দিন। Vercel/Render স্বয়ংক্রিয়ভাবে update হয়েছে; নতুন migration বা Supabase-এ হাতে SQL লাগেনি। Expense reason / details ফাঁকা রাখা যাবে।

এই update-এ Stock → স্টকের তথ্য সম্পাদনা দিয়ে অবিক্রীত পণ্যের তথ্য ও কারণ দিন। বাস্তবে supplier-কে ফেরত দিলে “Supplier-কে পণ্য ফেরত” থেকে supplier-এর অনুমোদিত ফেরতমূল্য দিন। Review-তে বাকি সমন্বয়, ফেরত পাওনা ও কাটতি দেখুন। টাকা হাতে এলে টাকা ও বাকি → “Supplier-এর ফেরত টাকা আদায়” থেকে প্রকৃত পরিমাণ এবং Cash/Bank দিন। আংশিক আদায় করা যাবে; মূল history মুছবে না।

আপনি বন্ধ করতে না বলা পর্যন্ত Codex app update-এর পরে প্রয়োজনীয় deployment ও live verification করে দেবে। এই নির্দেশনাটি নিজে শেখা ও প্রয়োজনে কাজ করার জন্য।

## Dashboard-এর অঙ্ক দেখা

**New sale / নতুন বিক্রি** এখন Workspace মেনুতে **Purchases / কেনাকাটা-এর ঠিক উপরে** থাকবে। [নতুন বিক্রির পাতা](https://tech-trolley-internal.vercel.app/sale) থেকে একই বিক্রির ফর্ম পূরণ → Review → Confirm করুন। সফল বিক্রির পরে invoice খুলবে এবং পরের বিক্রির জন্য ফর্ম খালি হবে। **Today’s overview**-এর New sale / Reconcile cash আগের মতো আছে; অন্য পাতার header-এ এই দুটি shortcut থাকবে না। এই update-এ Supabase migration বা হাতে SQL লাগবে না।

এই navigation update live: `3044385`; [CI verification](https://github.com/asadbinjafor/TECH-TROLLY/actions/runs/41098505219) পাস। Vercel ও Render স্বাভাবিক Git/CI পথে update হয়েছে; `/api/health`-এ এই API revision পাবেন। নতুন পাতা দেখতে একবার refresh দিন।

Dashboard-এর টাকার অঙ্ক শুরুতে ঢাকা থাকবে। **টাকার অঙ্ক দেখতে চাপুন / Tap to see balance** থেকে নিজের account-এর বর্তমান password দিন। সঠিক হলে এক মিনিট Dashboard-এর অঙ্ক দেখা যাবে; Hide চাপলে, অন্য পাতায় গেলে, refresh করলে বা অ্যাপ থেকে বের হলে আবার ঢাকবে। অন্য পাতার access আগের মতো। Quick actions-এর বড় রঙিন কার্ডে চাপলে আগের কেনাকাটা/খরচ/স্থানান্তর/ধার ফর্মই খুলবে। এই code update-এ নতুন migration লাগবে না; Vercel ও Render দুটোই স্বাভাবিক Git/CI পথে update হবে।

এই update live: API `68cc508`, website `0f41923`; [final CI verification](https://github.com/asadbinjafor/TECH-TROLLY/actions/runs/41094873527) পাস। [স্থায়ী অ্যাপ](https://tech-trolley-internal.vercel.app/) একবার refresh দিন। Website-এর শেষ সংশোধন শুধু frontend-এর হওয়ায় API health-এ `68cc508` থাকাই ঠিক; version mismatch error নয়।

## DUE / ধার-পাওনা ব্যবহার

মেনু অথবা **টাকা ও বাকি → DUE · ধার-পাওনা** খুলুন। **ধার দিন** থেকে ব্যক্তির নাম নির্বাচন করুন; নাম না থাকলে যোগ করুন। Staff-কে ব্যক্তিগত ধার দিলেও এখানে Person হিসেবে নাম রাখবেন; বেতন অগ্রিম আলাদা। টাকা, Cash/Bank ও বিবরণ দিয়ে Review → Confirm করুন। একই ব্যক্তিকে আবার দিলে তার কার্ডের **আবার ধার দিন** ব্যবহার করুন।

টাকা বাস্তবে ফেরত পেলে ব্যক্তির **টাকা ফেরত নিন** → যে ধারটির টাকা পেয়েছেন সেটি → প্রকৃত পরিমাণ এবং যে Cash/Bank-এ পেয়েছেন সেটি দিন। আংশিক আদায় করা যাবে; কয়েকটি ধারের টাকা একসঙ্গে পেলে প্রতিটি মূল ধার অনুযায়ী আলাদা আদায় লিখবেন। পুরো ফেরত পাওয়া নাম **সব · পরিশোধিতসহ** থেকে পাওয়া যাবে। ইতিহাসে তারিখ, লিখেছেন কে, Cash/Bank ও বিবরণ থাকবে। পুরোনো হিসাব Owner দেখবেন/আদায় করবেন; Staff শুধু আজকের। এই update-এ নতুন migration নেই; Expense reason / details-ও optional হচ্ছে।

## আপনার তিনটি service

| অংশ | কোথায় | কী কাজ করে |
| --- | --- | --- |
| Website | [Vercel project](https://vercel.com/asad-6810/tech-trolley-internal) | দোকানের screen ও browser-এর `/api` proxy |
| Backend/API | [Render service](https://dashboard.render.com/web/srv-dbhqf66gekts73bv6phg) | Login, stock, হিসাব, permission |
| Database | [Supabase project](https://supabase.com/dashboard/project/iejosjzhjjeykxknbxdw) | সংরক্ষিত হিসাব ও stock |

ব্যবহার করার স্থায়ী link: **https://tech-trolley-internal.vercel.app/**। Vercel-এর প্রতিবারের preview/deployment URL ব্যবহার করবেন না; সেগুলো app-এর production write origin নয়।

## এখন push করলেই কী হয়

Production branch **`codex/tech-trolley-production`**-এ commit/push করলে:

1. GitHub **Verify** build, permission/accounting tests ও typecheck চালায়।
2. **Vercel** connected Git integration দিয়ে website build/deploy করে। নতুন deployment **Ready** হলে স্থায়ী website update হয়।
3. Backend-সম্পর্কিত file বদলালে **Render → Auto-Deploy: After CI Checks Pass** সব CI check পাস হওয়ার পরে API build/deploy করে। **Live** হলে নতুন backend চালু হয়।
4. Render startup-এর versioned migration runner **Supabase database**-এ শুধু নতুন migration apply করে, তারপর existing Owner/bootstrap পরীক্ষা করে API চালায়। আগে apply করা SQL checksummed history থেকে skip হয়। Supabase-এ আলাদা Deploy চাপতে হয় না।

অর্থাৎ সাধারণ update-এ শুধু commit/push করুন এবং **Verify → Vercel Ready → Render Live** দেখুন। একই push-এর automatic deployment চললে আবার Manual Deploy চাপবেন না। Website ও API একই মুহূর্তে বদলায় না; database/API পরিবর্তন আগের ও পরের client-এর সঙ্গে compatible রাখতে হবে।

Render-এর Build Filters-এ backend/migrations, shared contracts/i18n, সব workspace package manifests, root lockfile/npm configuration ও API release/start scripts রাখা হয়েছে। শুধু frontend screen/CSS, mobile screen বা docs পাল্টালে backend আবার build হয় না। তখন Render-এ আগের Live commit থাকাই স্বাভাবিক। নতুন backend source/dependency directory যোগ করলে `render.yaml` এবং Render Settings-এর filter-ও মিলিয়ে update করুন।

## ১. নতুন code GitHub-এ দিন

Profile বদলাতে deployment লাগে না: **সেটিংস → আমার প্রোফাইল → প্রোফাইল সম্পাদনা** থেকে নাম, ইউজার আইডি ও ইমেইল বদলান। ID/Email বদলাতে নিজের বর্তমান password দিন; এরপর নতুন ID/Email দিয়ে আবার login করতে হবে। একই section-এ পাসওয়ার্ড পরিবর্তন আছে। Owner অন্য account-এর profile সম্পাদনা করলে identity পরিবর্তনের জন্য নিজের Owner password দেবেন। আগের invoice-এর seller name অক্ষত থাকবে।

কোনো dropdown খালি দেখালে এখন নিচের কারণটি পড়ুন: stock না থাকলে আগে কেনাকাটা লিখুন; Staff না থাকলে মালিক সেটিংসে অ্যাকাউন্ট তৈরি করবেন; বাকি আদায়/পরিশোধের তালিকায় শুধু অনুমোদিত তারিখের বাকি লেনদেন আসবে। তথ্য না থাকলে Review বন্ধ থাকবে—এটি deployment error নয়। খালি তালিকা ভরতে পরীক্ষামূলক লেনদেন যোগ করবেন না।

Supplier/Customer/ব্যক্তির নাম যোগ, সম্পাদনা বা তালিকা থেকে সরাতে code edit বা deployment লাগে না। ফর্মের **নাম যোগ / পরিচালনা করুন** অথবা ব্যক্তি/যোগাযোগের তালিকা ব্যবহার করুন। সরানো নাম পরে ফিরিয়ে আনা যায়; আগের লেনদেন ও বাকি থাকে। এই সুবিধার প্রথম code update-এ migration **007** Render startup থেকে স্বয়ংক্রিয়ভাবে হবে; Supabase-এ হাতে SQL চালাবেন না।

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

Backend, shared API contract বা database migration বদলালে এখন **After CI Checks Pass** অনুযায়ী automatic deployment হবে। Settings → Build-এ repository/production branch এবং Deploy-এ Auto-Deploy **After CI Checks Pass** মিলিয়ে দেখতে পারেন। সাধারণ update-এ নিজে Deploy চাপতে হবে না। [Render-এর নিয়ম](https://render.com/docs/deploys#configuring-auto-deploys)।

1. উপরের Render service খুলুন। নাম **tech-trolley-internal-api** কি না মিলিয়ে নিন।
2. GitHub **Verify** পাস হওয়ার পরে নতুন automatic deployment দেখুন। Check fail করলে আগে সেটি ঠিক করে push দিন; zero checks বা failed check থাকলে Render auto deploy করে না।
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
Auto-Deploy: After CI Checks Pass
```

Automatic deploy না চললে আগে branch, CI result ও Build Filters মিলিয়ে নিন। প্রয়োজনীয় recovery/configuration-only redeploy করতে **Manual Deploy → Deploy latest commit** ব্যবহার করা যায়। **Deploy a specific commit** ব্যবহার করলে Render Auto-Deploy বন্ধ করে দেয়; পরে Settings-এ **After CI Checks Pass** আবার চালু করুন। Manual deploy CI gate এড়িয়ে চলে, তাই আগে verified commit নিশ্চিত করুন।

## ৪. Supabase: কখন কাজ করতে হবে

সাধারণ UI/code update-এ Supabase-এ আলাদা Deploy বোতাম চাপতে হয় না। `migrations/`-এ নতুন versioned SQL file থাকলে Render-এর normal startup runner তা apply করে। SQL Editor থেকে আবার একই migration চালানো, table reset করা বা sample transaction ঢোকানোর প্রয়োজন নেই। Production database-এ `npm test` চালাবেন না।

অনেক দিন ব্যবহার না করার পরে project **Paused** দেখালে Supabase dashboard থেকে **Restore** করে **Healthy** হওয়া পর্যন্ত অপেক্ষা করুন। তারপর website খুলুন; API যদি পুনরায় চালু না হয়, Render-এর **Manual Deploy → Restart service** দিয়ে চালু করুন। [Supabase-এর inactivity policy](https://supabase.com/docs/guides/deployment/going-into-prod#availability)।

## ৫. সবশেষে কীভাবে নিশ্চিত হবেন

1. [Website](https://tech-trolley-internal.vercel.app/) খুলুন। Startup screen এলে সেটি খোলা রাখুন; server/database প্রস্তুত হলে login/dashboard নিজে থেকে আসবে।
2. [Web API health](https://tech-trolley-internal.vercel.app/api/health) এবং [Render health](https://tech-trolley-internal-api.onrender.com/health) প্রস্তুত অবস্থায় `{"status":"ok"}` দেবে।
   Render-এ এখন `revision`-ও থাকবে: এটি চলমান backend-এর Git commit SHA। GitHub-এর প্রত্যাশিত commit-এর সঙ্গে মিললে শুধু পুরোনো Live badge দেখে ভুল হওয়ার সুযোগ কমে। Frontend-only update হলে backend-এর আগের commit থাকাই স্বাভাবিক।
3. নিজের account দিয়ে login করে dashboard, stock ও প্রয়োজনীয় report দেখুন। শুধু পরীক্ষা করার জন্য আসল shop-এ নকল sale/খরচ post করবেন না।
4. Website-এ আগের screen থাকলে refresh করুন। Build/Live/health/ব্যবহার—সব ধাপ মিললেই update শেষ।

## দোকানের দুই-পৃষ্ঠার memo / PDF

Receipt খুলে **Print / Save PDF** চাপুন। Paper **A4**, Scale **100%**, browser Headers and footers **Off** রাখুন; template-এর default margin ব্যবহার করুন। PDF-এর প্রথম পৃষ্ঠা invoice front, দ্বিতীয় পৃষ্ঠা শর্তাবলি/back। Printer-এ একই কাগজের দুই পাশে ছাপাতে **Print both sides → Flip on long edge** বেছে নিন। Duplex না থাকলে আগে এক কাগজে orientation পরীক্ষা করে উল্টো পিঠ ছাপান।

Customer, product এবং আসল বিক্রয়কারীর নাম/Owner বা Staff role সংরক্ষিত sale থেকে আসে। শুধু পরীক্ষা করার জন্য live দোকানে নকল sale লিখবেন না; sample PDF আলাদা synthetic preview।

## Sleep ও অপেক্ষার screen

Render Free-তে ১৫ মিনিট inbound traffic না থাকলে service sleep করে; পরের request সেটি চালু করে এবং প্রায় এক মিনিট লাগতে পারে। [Render-এর নিয়ম](https://render.com/docs/free#spinning-down-on-idle)।

Website-এর public screen আগে থেকেই তৈরি static HTML হিসেবে আসে। এরপর database-backed health পরীক্ষা করা হয়। সংযোগের সময় animation, সত্যিকারের অপেক্ষার সময় ও ধাপ দেখা যায়; server প্রস্তুত হলে app নিজে থেকেই এগোয়। Read-only health probe সর্বোচ্চ দুই মিনিট চেষ্টা করে; probe-এর মাঝের বিরতি এখন সর্বোচ্চ ২ সেকেন্ড, আগে ৮ সেকেন্ড ছিল। সংযোগ না হলে স্পষ্ট Retry দেখায়; internet ফিরে এলে আবার চেষ্টা করে। Sale/খরচের POST automatic replay হয় না; কোনো submission uncertain হলে আগের একই key-এর status/retry ব্যবহার করুন।

### ফ্রিতে sleep কমানোর health check

[GitHub → Actions → Production health](https://github.com/asadbinjafor/TECH-TROLLY/actions/workflows/production-health.yml)-এ প্রতি ৫ মিনিটে public Render health endpoint পরীক্ষা হয়। এতে নিয়মিত inbound request যায়, service সাধারণত সচল থাকে এবং browser বন্ধ থাকলেও কাজটি চলে। এটি login করে না বা দোকানের কোনো হিসাব বদলায় না। Repository-টি বর্তমানে public; standard public runner-এ এই check-এর GitHub charge নেই। Private করলে খরচ এড়াতে workflow নিজে থেকে skip করবে।

- সর্বশেষ run সবুজ কি না ও log-এর `elapsedMs` দেখুন। Manual পরীক্ষা করতে **Run workflow → Run workflow** দিন।
- বন্ধ করতে workflow-এর **… → Disable workflow**; আবার চালু করতে **Enable workflow**। Code update হলেই Render deploy দিতে হয় না—এটি GitHub-এ চলে।
- GitHub schedule দেরি করতে বা কোনো run বাদ দিতে পারে; ৬০ দিন repository activity না থাকলে schedule disable হয়। তাই এটি সবসময় তাৎক্ষণিক খোলার guarantee নয়। [GitHub-এর সীমা](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)।
- Render-এর ৭৫০ free hours পুরো workspace-এর সব Free service মিলে ভাগ হয়। এই একটি service সারামাস সচল থাকলে সর্বোচ্চ ৭৪৪ ঘণ্টা লাগতে পারে; অন্য service বেশি চললে quota-ও দেখবেন। ২০২৬-১০-৩০ পরীক্ষার সময়ে usage ছিল ১.২৫/৭৫০ ঘণ্টা। Quota শেষ হলে provider-এর নিয়মে service suspend হতে পারে; health check quota বাড়ায় না।

আরও বিস্তারিত কারণ ও পরীক্ষার তথ্য: [cold-start audit](cold-start-audit.md)।

Render service-এর paid compute plan-এ এই idle spin-down থাকে না; workspace plan upgrade আলাদা বিষয়। Supabase Free project সাত দিনের কম activity-তেও pause হতে পারে এবং dashboard restore লাগতে পারে। Paid Render compute এবং Supabase Pro এই দুই inactivity সীমার সংশ্লিষ্ট সমাধান; plan ও খরচ Owner বেছে নেবেন। Animation কোনো provider outage, suspended account বা paused database নিজে থেকে ঠিক করতে পারে না।

## ভুল deployment হলে

নতুন deployment-এর logs ও commit আগে মিলিয়ে দেখুন। Vercel-এর working deployment-এ rollback এবং Render-এর working commit-এ redeploy/rollback করা যায়। Code rollback database migration undo করে না—database table মুছবেন না। Schema বদল থাকলে কোন API/web version একসঙ্গে compatible তা দেখে fix/release করুন। পূর্ণ hosting setup ও backup-এর জন্য [deployment guide](deploy-vercel-render-supabase-bn.md) দেখুন।


### খালি টাকা ও optional payment field-এর আপডেট

এই পরিবর্তন shared contracts/i18n এবং web/native form-এ। Production branch-এ push করলে আগের নিয়মেই Vercel deploy এবং CI পাসের পরে Render deploy হবে; নতুন Supabase migration নেই। Deploy শেষে নতুন বিক্রির form খুলে Discount/Cash/Bank খালি আছে কি না দেখুন। একটিতে পুরো টাকা লিখে Review করুন—অন্য ঘরে ০ দিতে হবে না। পরীক্ষার জন্য আসল বিক্রি Confirm করবেন না। কম টাকা পেলে Customer নির্বাচন করতে হবে; বাকি আলাদা হিসাব হবে।


### Invoice print/PDF আপডেট

Shared invoice/contracts, API ও web/native বদলেছে, তাই একই production branch-এ push → CI → Vercel/Render auto-deploy হবে। Supabase-এর নতুন migration নেই। পুরোনো sale খুলে Print / Save as PDF-তে A4 portrait, scale 100%, background graphics on এবং browser headers/footers off রাখুন। PDF দুই পৃষ্ঠা হবে; পৃষ্ঠা ১-এ gold thank-you এবং পৃষ্ঠা ২-এ TECH TROLLEY footer থাকবে। Seller-এর নামের জায়গা খালি ও সতর্কবার্তা এলে Settings-এ ওই বিক্রেতার প্রকৃত নাম দিন। ইতিমধ্যে সংরক্ষিত প্রকৃত নাম পাল্টানো হবে না।

পরীক্ষার HTML তৈরি: `npx tsx scripts/prepare-invoice-print-qa.ts`। এতে শুধু synthetic data ব্যবহার হয়, কোনো database record তৈরি হয় না। আসল customer data বা local receipt JSON Git-এ commit করবেন না।


### iPhone সহ সবার জন্য প্রস্তুত PDF

রসিদ খুলে **PDF খুলুন / প্রিন্ট** অথবা **PDF ডাউনলোড** চাপুন। অ্যাপের দেওয়া প্রস্তুত দুই পৃষ্ঠার A4 ফাইল থেকে print/share করুন। ফাইলের নাম invoice number দিয়ে হবে, যেমন `TT-000008.pdf`। Seller-এর display name সেই বিক্রেতার saved record/profile থেকে মাঝখানে আসবে। Profile-এ Owner নাম থাকলে Owner, Taki থাকলে Taki; demo নাম hardcode করা নেই।

API এখন shared invoice package ব্যবহার করে এবং নিজস্ব licensed Bengali font রাখে। Template source (`packages/invoice/src`) বদলালে commit/push-এর আগে `npm run prepare:invoice-release` চালান এবং তৈরি backend `invoice-version.ts` commit করুন। CI ভুলে যাওয়া fingerprint ধরবে; বর্তমান Render backend-path filter এই ফাইলের পরিবর্তন দেখে API-ও auto-deploy করবে। Dashboard filter এখন বদলাতে হবে না; render.yaml-এর existing paths একই আছে। নতুন migration বা paid upgrade লাগেনি।
