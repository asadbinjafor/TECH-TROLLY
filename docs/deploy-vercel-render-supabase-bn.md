# Vercel + Render + Supabase deployment

এই repository এখন এই তিনটি service-এ deploy করার জন্য প্রস্তুত:

| কাজ | Service |
| --- | --- |
| Web/Next.js | Vercel |
| NestJS API | Render |
| PostgreSQL database | Supabase |

Repository: [asadbinjafor/TECH-TROLLY](https://github.com/asadbinjafor/TECH-TROLLY)

Deploy branch: **`codex/tech-trolley-production`**। পুরোনো reference repository বা পুরোনো live service পরিবর্তন করার প্রয়োজন নেই। নতুন project/service তৈরি করুন। নিচের `YOUR_...` লেখা মানগুলো উদাহরণ/placeholders—dashboard থেকে আপনার আসল value বসাবেন। কোনো live deployment বা account connection এই configuration তৈরির সময় করা হয়নি।

## ১. Supabase database তৈরি করুন

1. [Supabase Dashboard](https://supabase.com/dashboard)-এ নতুন project তৈরি করুন। Database password ব্যক্তিগতভাবে সংরক্ষণ করুন। Render-এর জন্য নিচের blueprint Singapore ব্যবহার করে; সম্ভব হলে database-এর কাছাকাছি region নিন।
2. Project-এর **Connect** খুলে **Session pooler / Session mode** connection string কপি করুন। Port হবে **5432**। Host, project reference এবং username dashboard-এরটি হুবহু রাখুন। Persistent Render API-এর জন্য এই পথটি IPv4-তেও কাজ করে। [Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres)।
3. Connection string-এর password placeholder বদলান। Password-এ `@`, `:`, `/`, `#` ইত্যাদি থাকলে URL-encode করা password লাগবে। Supabase project-এর database password ব্যবহার করবেন, Supabase account login password নয়।
4. এই application শুধু Nest API দিয়ে database ব্যবহার করে। Supabase-এর **Data API** প্রয়োজন নেই; নতুন project-এর Data API settings থেকে সেটি বন্ধ রাখুন। Supabase Auth-এ user বানাতে হবে না—নিজস্ব `app_user` ও session system আছে।
5. Database settings থেকে **SSL enforcement** চালু রাখুন। Certificate validation চালু থাকবে; `rejectUnauthorized=false` করা হয়নি। প্রয়োজন হলে dashboard-এর **Download Certificate** থেকে root certificate নামিয়ে তার base64 Render-এর `DATABASE_SSL_CA_BASE64`-এ দিন।

Certificate-টি public certificate; base64 কপি করার PowerShell command:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\actual-folder\downloaded-certificate.crt')) | Set-Clipboard
```

পরে Render environment value-তে paste করবেন। Path-এ আপনার আসল downloaded file বেছে নিন। System-trusted certificate হলে এই optional variable খালি রাখা যায়। [Supabase SSL নির্দেশনা](https://supabase.com/docs/guides/database/connecting-to-postgres#ssl)।

কোনো SQL file আলাদাভাবে copy/paste করে চালানোর প্রয়োজন নেই। Render start command versioned migrations চালাবে। নতুন `003_private_app_tables.sql` application-এর table-এ RLS চালু করে এবং Supabase-এর `anon`/`authenticated`/`service_role` থেকে table/sequence access সরায়। Nest সংযোগের `postgres` table-owner account দিয়ে কাজ করবে। অন্য Supabase schema/table পরিবর্তন করা হবে না। [Data API security](https://supabase.com/docs/guides/api/securing-your-api)।

**ভুল value এড়ান:** `https://YOUR_PROJECT.supabase.co`, anon/publishable key বা service-role key—কোনোটিই `DATABASE_URL` নয়। Vercel বা Expo-তে database password/connection string লাগবে না।

## ২. Vercel-এ web project import করুন

1. [Vercel](https://vercel.com/new)-এ **Add New → Project** থেকে `asadbinjafor/TECH-TROLLY` import করুন।
2. নিচের settings দিন:

| Vercel setting | Value |
| --- | --- |
| Framework Preset | **Next.js** |
| Root Directory | **`tech-trolley-frontend`** |
| Node.js Version | **24.x** |
| Production Branch | **`codex/tech-trolley-production`** |
| Install Command | `cd .. && npm ci --include=dev` |
| Build Command | `cd .. && npm run build:web` |
| Output Directory | Default রাখুন; হাতে কোনো text/path লিখবেন না |

`tech-trolley-frontend/vercel.json`-এ install/build configuration দেওয়া আছে; dashboard-এর পুরোনো custom override থাকলে সরিয়ে দিন বা উপরের সঙ্গে মিলিয়ে নিন। Monorepo-এর root lockfile ও `packages/` build-এর জন্য দরকার। Root Directory-এর বাইরে source include করার option দেখালে সেটি enabled রাখুন। [Vercel monorepo guide](https://vercel.com/docs/monorepos)।

3. **Environment Variables**-এ দিন:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | **`/api`** |
| `API_UPSTREAM_URL` | পরে আপনার Render service-এর আসল HTTPS URL, যেমন `https://YOUR_ACTUAL_SERVICE.onrender.com` |

Render URL এখনও না থাকলে প্রথম deploy-তে `API_UPSTREAM_URL` unset রাখতে পারেন। Login page build হবে, কিন্তু API সংযোগ শেষ না হওয়া পর্যন্ত login কাজ করবে না—এটি প্রত্যাশিত। কোনো বানানো Render URL বসাবেন না।

4. Deploy শেষে Vercel-এর **স্থায়ী production domain** কপি করুন, যেমন `https://YOUR_ACTUAL_PROJECT.vercel.app`। পরের ধাপে এটি Render-এর `WEB_ORIGIN` হবে। Branch/commit preview domain-এর বদলে production domain ব্যবহার করুন।

## ৩. Render-এ API deploy করুন

[Render Dashboard](https://dashboard.render.com)-এ **New → Web Service** দিয়ে একই GitHub repository connect করুন।

| Render setting | Value |
| --- | --- |
| Repository | `asadbinjafor/TECH-TROLLY` |
| Branch | **`codex/tech-trolley-production`** |
| Runtime/Language | **Node** |
| Root Directory | **ফাঁকা রাখুন**—repository root থেকে command চলবে |
| Region | Singapore, অথবা আপনার নির্বাচিত database-এর কাছাকাছি |
| Build Command | **`npm ci --include=dev && npm run build:api`** |
| Start Command | **`npm run start:render`** |
| Health Check Path | **`/health`** |
| Auto Deploy | প্রথমে Off/Manual |
| Plan | Free দিয়ে পরীক্ষা করা যায়; আপনার প্রয়োজন অনুযায়ী পরে নির্বাচন করুন |

**Root Directory-তে `tech-trolley-backend` বসাবেন না।** এই নতুন repository-তে shared packages এবং একটিমাত্র root lockfile আছে; পুরোনো repository-এর deployment settings এখানে হুবহু ব্যবহার করলে build fail হতে পারে।

বিকল্পভাবে **New → Blueprint** দিয়ে repository-root-এর `render.yaml` ব্যবহার করতে পারেন। এতে Supabase-এর বদলে নতুন Render database তৈরি হবে না। `sync: false` variables-এ আপনার বাস্তব values চাইবে। Blueprint-এ service name প্রস্তাব হিসেবে দেওয়া—আপনার service তৈরি না হওয়া পর্যন্ত কোনো নির্দিষ্ট `onrender.com` URL নিশ্চিত নয়। [Render Blueprint reference](https://render.com/docs/blueprint-spec)।

### Render Environment Variables

| Variable | কী বসাবেন |
| --- | --- |
| `NODE_VERSION` | `24.17.0` |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Supabase Connect-এর **Session pooler 5432** connection string, সঠিক database password-সহ |
| `DATABASE_SSL` | `true` |
| `DATABASE_POOL_MAX` | `5` |
| `DATABASE_SSL_CA_BASE64` | Optional: downloaded certificate-এর base64; TLS chain error হলে ব্যবহার করুন |
| `WEB_ORIGIN` | Vercel-এর আসল production origin, যেমন `https://YOUR_ACTUAL_PROJECT.vercel.app`; শেষে `/` নয় |
| `BOOTSTRAP_OWNER_EMAIL` | আপনার master brief-এ দেওয়া initial Owner email |
| `BOOTSTRAP_OWNER_PASSWORD` | আপনার master brief-এ দেওয়া initial Owner password |

Initial credentials এখানে লিখে commit করা হয়নি। এগুলো শুধু Render-এর secret environment values-এ দিন। `PORT` নিজে বসাতে হবে না; Render যে port দেয় API সেটিই ব্যবহার করে। এই application-এর জন্য `JWT_SECRET`, Supabase anon key বা Supabase Auth signup setting প্রয়োজন নেই।

Start command এই ক্রমে কাজ করে:

1. Checksummed SQL migrations—existing migration আবার apply করে না।
2. Idempotent first-Owner bootstrap—আগে account তৈরি হয়ে থাকলে password বদলায় না, account duplicate করে না, category/লেনদেন reseed করে না।
3. API start; `0.0.0.0` ও Render-এর `PORT`-এ listen।

এটি Free plan-এও migration চালানোর জন্য সচেতনভাবে start lifecycle-এ রাখা হয়েছে। Build command database পরিবর্তন করে না। Migration ব্যর্থ হলে API চালু হবে না। Data reset/drop/synchronize নেই। প্রথম successful bootstrap-এর পরে দুই bootstrap secret remove/empty করে redeploy করা যায়; existing account অপরিবর্তিত থাকবে।

Paid service-এ আলাদা pre-deploy ধাপ চাইলে:

| Setting | Value |
| --- | --- |
| Pre-Deploy Command | `npm run release:api` |
| Start Command | `npm start --workspace @tech-trolley/backend` |

Free service-এ pre-deploy command পাওয়া যায় না, তাই Free setup-এ ওই field দরকার নেই। [Render deploy lifecycle](https://render.com/docs/deploys#pre-deploy-command)।

Deploy শেষ হলে Render-এর বাস্তব service URL-এর `/health` খুলুন। Expected response:

```json
{"status":"ok"}
```

Render-এর root URL-এ Next.js login page আসবে না। Login page Vercel-এ; Render API আলাদা service।

## ৪. Vercel ও Render সংযোগ শেষ করুন

1. Render dashboard থেকে আসল service URL কপি করুন।
2. Vercel → Project → Settings → Environment Variables:
   - `API_UPSTREAM_URL=https://YOUR_ACTUAL_SERVICE.onrender.com`
   - `NEXT_PUBLIC_API_URL=/api`
3. Environment পরিবর্তনের পরে Vercel **Redeploy** দিন। `API_UPSTREAM_URL`-এর শেষে `/api` যোগ করবেন না।
4. Browser-এ Vercel production URL খুলে `/api/health` দেখুন। এখানেও `{"status":"ok"}` আসবে।

Request flow:

```text
Browser → Vercel /api/... → Render Nest API → Supabase PostgreSQL
```

Browser-এর session cookie Vercel domain-এই থাকে। Proxy শুধু request/response পাঠায়; authorization, stock, profit বা accounting logic Nest-এই থাকে। Cookie `HttpOnly`, production-এ `Secure` এবং `SameSite=Strict` থাকে। Idempotency key ও CSV download-ও proxy দিয়ে যায়। সরাসরি Render URL-কে web-এর `NEXT_PUBLIC_API_URL` বানিয়ে এই setup বদলাবেন না।

Custom domain যোগ করলে Render-এর `WEB_ORIGIN`-এ exact origin যোগ করুন। একাধিক অনুমোদিত origin comma দিয়ে লিখতে পারেন। সব `*.vercel.app` origin খোলা নয়। Preview deployment production DB-তে লেখার সুযোগ default হিসেবে দেবেন না; preview দরকার হলে আলাদা staging API/database ব্যবহার করুন।

## ৫. প্রথম login ও নিজের দোকানের setup

1. Vercel production URL-এ brief-এর initial Owner credentials ব্যবহার করুন। User ID `owner` দিয়েও login করা যায়।
2. প্রথম login-এ password change চাইবে। পরিবর্তন শেষে নতুন password দিয়ে login করুন।
3. নিজের সত্যিকারের shop address/contact Settings-এ দিন। Opening cash/bank বাস্তব তথ্য অনুযায়ী একবার save করুন; zero/zero-ও গ্রহণযোগ্য।
4. দরকার হলে private User Management থেকে Owner/Staff account তৈরি করুন। Public signup নেই।
5. নতুন production project-এ sample stock/লেনদেন import করা হবে না। নিজের প্রকৃত কাজ শুরু করুন; test data দেওয়ার জন্য আলাদা staging database রাখুন।

## সমস্যা হলে

| লক্ষণ | কী যাচাই করবেন |
| --- | --- |
| Vercel build-এ package/TypeScript পাওয়া যায় না | Root Directory `tech-trolley-frontend`; install/build উপরের মতো workspace root-এ; outside-root sources available |
| `API_CONFIGURATION_REQUIRED` | Vercel server variable `API_UPSTREAM_URL` missing/invalid; actual HTTPS Render URL বসিয়ে redeploy |
| `ORIGIN_REJECTED` / login থাকে না | `NEXT_PUBLIC_API_URL=/api`; Render `WEB_ORIGIN` exact Vercel production origin; Vercel redeploy হয়েছে কি না |
| `ENETUNREACH` / IPv6 database connection error | Supabase Direct URL-এর বদলে **Session pooler 5432** copy করেছেন কি না |
| `28P01` / password authentication failed | Database password, URL encoding, project-specific pooler username ঠিক কি না |
| `Tenant or user not found` | একই project-এর host ও username দুটোই Connect থেকে copy করুন; project reference অনুমান করবেন না |
| Certificate/TLS chain error | সঠিক project certificate base64 দিন; `DATABASE_SSL=true` রাখুন |
| `DATABASE_URL_INVALID` | পূর্ণ PostgreSQL connection string দিন; HTTPS project URL বা অসম্পূর্ণ placeholder নয় |
| Render Live, কিন্তু web API unavailable | Render `/health` আগে যাচাই করুন; Vercel upstream URL এবং redeploy যাচাই করুন |
| প্রথম request ধীর/timeout | Free Render service idle-এর পরে চালু হতে সময় নেয়। `/health` খুলে প্রস্তুত হওয়া পর্যন্ত অপেক্ষা করুন; তারপর retry |
| Supabase SQL Editor-এ table আছে, Supabase Auth users নেই | স্বাভাবিক—এই app-এর account table `app_user`; Supabase Auth ব্যবহার করা হয়নি |

Free Render service ১৫ মিনিট idle থাকলে spin down হতে পারে; ফের চালু হতে প্রায় এক মিনিট লাগতে পারে। এই সময় proxy/clients unavailable বা uncertain submission দেখাতে পারে। Financial entry হলে একই key-এর status/retry ব্যবহার করুন, নতুন duplicate entry দেবেন না। [Render Free limitations](https://render.com/docs/free#spinning-down-on-idle)।

## Backup, update ও native app

- Supabase-এর plan অনুযায়ী backup সুবিধা মিলিয়ে নিন। Free project-এর automatic daily backup ধরে নেবেন না; নিয়মিত off-site export রাখুন। [Supabase backups](https://supabase.com/docs/guides/platform/backups)। বিদ্যমান backup/restore পদ্ধতি [deployment.md](deployment.md)-এ আছে। Certificate-সহ `pg_dump` করলে `PGSSLROOTCERT`-এ downloaded certificate path দিন; real database secret শুধু private environment-এ রাখুন।
- নতুন code deploy-এর আগে backup নিন, GitHub CI পাস দেখুন, তারপর Render manual deploy দিন। Migrations existing history মুছবে না। `npm test` বা `TEST_DATABASE_URL` কখনো production Supabase connection দিয়ে চালাবেন না; acceptance tests শুধু isolated database-এর জন্য।
- Android/iOS-এ `EXPO_PUBLIC_API_URL` হবে আসল **Render HTTPS URL**, শেষে `/api` ছাড়া। Native SecureStore/Bearer session ব্যবহার করে; Vercel browser proxy তার প্রয়োজন নেই। Signed build ও device steps [mobile-release.md](mobile-release.md)-এ আছে।

## কী যাচাই করা হয়েছে

Local web/API build ও typecheck, cookie/header/idempotency/CSV proxy tests, Supabase TLS configuration tests, real PostgreSQL migration/RLS ও পুনরায় release/bootstrap tests পাস করেছে। `render.yaml` এবং `vercel.json` live provider JSON schema দিয়ে validate হয়েছে। কোনো বাস্তব Vercel/Render/Supabase project account-এ deploy হয়নি; আপনার actual project URL/secrets ছাড়া সেটি নিশ্চিত করা সম্ভব নয়।
