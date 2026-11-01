# নিজে deployment করার নির্দেশনা

## নতুন Dashboard / DUE design — ২০২৬-১১-০২

এই update শুধু Web UI-তে। বর্তমান `codex/tech-trolley-production` branch-এ commit/push করলে Vercel-এর Git integration নিজে deploy করবে। [GitHub Actions](https://github.com/asadbinjafor/TECH-TROLLY/actions) সবুজ এবং [লাইভ অ্যাপ](https://tech-trolley-internal.vercel.app/) নতুন design দেখাচ্ছে কি না মিলিয়ে নিন। API dependency বদলায়নি, তাই Render-এর পুরোনো verified `147fd41` revision থাকাই ঠিক; Supabase-এ migration/SQL বা manual deploy লাগবে না।

Refresh করে light/dark ও বাংলা/ইংরেজিতে দেখুন: Cash/Bank card, চারটি রঙিন Quick actions, mobile Dashboard-এর New sale, নিচের চারটি navigation, DUE-তে ব্যক্তির card এবং Details/টাকা ফেরত নিন। অঙ্ক দেখতে নিজের password লাগবে। Cash/Bank card-এর ডানদিকের arrow-তে opening ও চলতি টাকা দেখা যাবে। পরীক্ষার জন্য আসল sale/repayment post করবেন না। [আলাদা test database-এর audit](ui-concept-audit.md) দেখুন।

**অডিটে পাওয়া সমস্যার সংশোধন:** Native receipt-এ আগের বিক্রির আসল business date দেখাবে। Contact-এর ধরন Supplier/Customer/Person-ই থাকবে; invalid ধরন বা report-এর year zero-তে 500 নয়, validation error আসবে। Details-এর নির্দিষ্ট label/option বাংলা-ইংরেজি হবে; নিজের লেখা নাম/model/note বদলাবে না। পুরোনো guide-এ Staff history ও initial password change-এর অমিলও ঠিক করা হয়েছে।

এই update-এ database migration বা data reset নেই। বর্তমান production branch-এ commit/push → CI সফল → Vercel এবং Render-এর স্বাভাবিক auto-deploy। এরপর দুই health endpoint-এর revision, live Details এবং invalid report-date validation যাচাই করুন। কোনো আসল লেনদেন/নাম/পাসওয়ার্ড পরিবর্তনকে deployment test হিসেবে ব্যবহার করবেন না। Native source ও Android/iOS export আলাদা; ফোনে install করা app আপডেট করতে signed build/distribution প্রয়োজন, শুধু Vercel deploy করলে native binary আপডেট হয় না।

অডিট সংশোধনের release `147fd41` live হয়েছে; [পূর্ণ CI সফল](https://github.com/asadbinjafor/TECH-TROLLY/actions/runs/41284733593)। Vercel/Render-এর health revision ও নতুন web labels মিলেছে; আগের ১৩টি account/business/schema table অপরিবর্তিত। Local-এ ৮০টি backend ও ৩৯টি form/hosting check পাস। সংরক্ষিত login গ্রহণ না করায় protected live validation করা হয়নি; password reset/guess বা আসল লেনদেন দিয়ে পরীক্ষা করা হয়নি। নিজের বর্তমান login দিয়ে ব্যবহার করুন; native device acceptance এখনও আলাদা কাজ।

**লেখা ও Optional-এর রং:** সাধারণ লেখা/তারিখ medium, sidebar কিছুটা bold এবং field title আরও bold। সব form-এর Optional/ঐচ্ছিক muted rose-red; dark theme-এ আলাদা হালকা rose ব্যবহার হয়। শুধু লেখার style বদলেছে—কোন field বাধ্যতামূলক বা হিসাব কীভাবে সেভ হয় তা আগের মতো। এই frontend/native update push করলে Vercel Git deployment হবে। API/schema বদলায়নি, তাই Render manual deploy বা Supabase SQL চালানোর প্রয়োজন নেই। Live CSS ও mobile view দেখে release মিলিয়ে নেবেন; native source-এর জন্য Android/iOS export যাচাই করবেন।



লেখার update live: `14a561e`; [পূর্ণ CI সফল](https://github.com/asadbinjafor/TECH-TROLLY/actions/runs/41246458950)। Vercel-এ প্রকাশিত CSS ও live login-এর font weight মিলেছে। বাংলা/English, light/dark এবং mobile view পরীক্ষা করা হয়েছে। Refresh দিলে নতুন style পাবেন; API আগের যাচাই করা `4054eb8` version-এ চলছে।

**আগের হিসাব থেকে শুরু:** Owner → Settings → আগের হিসাব থেকে শুরু। এটি সাধারণ Opening দেওয়ার আগের একবারের setup; চালু দোকানের ডেটা মুছবে না। শুরুর সকালের টাকা, stock ও বাকি → নিশ্চিত → আগের দিনের লেনদেন তারিখের ক্রমে → Reports মিলিয়ে বাস্তব Cash/Bank দিয়ে setup শেষ। [পুরো বাংলা নির্দেশনা](historical-accounts-bn.md) পড়ুন; একই পণ্যের বাকি দুই জায়গায় তুলবেন না।

এই release-এ migration `011_historical_onboarding.sql` আছে। স্বাভাবিক production branch-এ commit/push করলে Vercel Git integration frontend deploy করবে; CI সফল হলে Render API deploy করে নিজস্ব startup runner-এ Supabase migration চালাবে। Dashboard থেকে আলাদা SQL, reset বা দ্বিতীয় migration pipeline চালাবেন না। আগে backup, পরে CI/দুই health revision/১১টি migration এবং পুরোনো business-record fingerprint যাচাই করতে হবে। কোনো আসল opening বা লেনদেন deployment-এর পরীক্ষা হিসেবে সেভ করবেন না।



আগের হিসাবের update live হয়েছে: `4054eb8`; [পূর্ণ CI সফল](https://github.com/asadbinjafor/TECH-TROLLY/actions/runs/41244755242)। Vercel/Render-এর version, startup-এ ১১টি migration এবং পুরোনো ডেটা/Owner password অক্ষত থাকা যাচাই হয়েছে। Live-এ কোনো opening বা পরীক্ষার লেনদেন দেওয়া হয়নি। Settings refresh করে নির্দেশনা মেনে শুরু করুন।

**প্রিন্ট ছাড়া বিক্রি:** New sale পূরণ করে Review চাপুন। এরপর **প্রিন্ট ছাড়া বিক্রি সেভ করুন** বেছে নিলে বিক্রি, স্টক, Cash/Bank, বাকি ও লাভ স্বাভাবিকভাবে জমা হবে; invoice screen খুলবে না। **বিক্রি সেভ করে ইনভয়েস দেখুন** বেছে নিলে আগের মতো invoice খুলবে। পরে Daybook/লেনদেন থেকে একই বিক্রির Receipt খুলে PDF/Print করা যাবে। বাকি রাখলে Customer বাছতে হবে। Network সমস্যা হলে দেখানো status/retry ব্যবহার করবেন; একই বিক্রি নতুন করে লিখবেন না। এই update-এ migration/হাতে SQL লাগে না; shared ভাষার label বদলানোয় বর্তমান build filters অনুযায়ী Vercel এবং Render স্বাভাবিক Git/CI পথে deploy হবে।

এই update live: `cf1dc8f`; [পূর্ণ CI সফল](https://github.com/asadbinjafor/TECH-TROLLY/actions/runs/41240415298)। Vercel/Render-এর প্রকাশিত revision ও নতুন বাটনের code যাচাই হয়েছে। Credit sale, discount/লোকসান, Staff, double-click, refresh/retry/status recovery, পরে বাকি আদায় ও একই invoice খোলার পরীক্ষা আলাদা test database-এ হয়েছে; Live হিসাব বদলানো হয়নি।

**Password-এর number keyboard:** Login, Dashboard-এর অঙ্ক দেখানো, profile যাচাই, password change, account তৈরি ও reset—সব password ঘরে মোবাইলের number keyboard চাওয়া হবে। Password আগের মতো ঢাকা থাকবে; 0 দিয়ে শুরু হলেও থাকবে। এই client update-এ Vercel deploy এবং native Android/iOS export যাচাই করবেন; API/Render বা Supabase migration লাগবে না। পুরোনো tab refresh করে দেখবেন।

এই update live: `c80e779`; [পূর্ণ CI সফল](https://github.com/asadbinjafor/TECH-TROLLY/actions/runs/41235952665)। Live login-এর numeric setting ও অন্য password controls-এর প্রকাশিত code যাচাই হয়েছে। আসল ফোনে password ঘরে tap করে keyboard দেখা আলাদা device check।

**৪ সংখ্যার password (১ নভেম্বর):** Settings → My profile → Change password থেকে বর্তমান password দিয়ে নতুন password-এ ঠিক ৪টি ইংরেজি সংখ্যা (0–9) দিন। শুরুতে 0 থাকলেও সংরক্ষিত থাকবে। Save হলে আবার login করতে হবে। নতুন Owner/Staff তৈরি বা password reset-এও একই নিয়ম। Update নিজে থেকে আপনার পুরোনো password বদলাবে না; পুরোনোটি দিয়ে login করে পরিবর্তন করবেন। ভুল password পাঁচবার দিলে ওই account-এর password যাচাই ১৫ মিনিটের window শেষ হওয়া পর্যন্ত বন্ধ থাকবে; User ID/email, tab বা login/unlock পাল্টালে সীমা মুছবে না। এই update-এ database migration বা Supabase-এ SQL প্রয়োজন নেই। স্বাভাবিক production branch-এ commit/push → GitHub Verify পাস → Vercel ও Render auto-deploy → web এবং `/api/health`-এ release যাচাই করবেন; নিয়মিত manual deploy দরকার নেই।

এই update live: `ddb8191`; [পূর্ণ CI সফল](https://github.com/asadbinjafor/TECH-TROLLY/actions/runs/41234372324)। Vercel ও Render স্বয়ংক্রিয়ভাবে update হয়েছে। পুরোনো Owner password দিয়ে login এবং ভুল দৈর্ঘ্যের নতুন password প্রত্যাখ্যান live-এ যাচাই হয়েছে; আপনার password বা হিসাবের data বদলানো হয়নি। পুরোনো tab refresh করে Settings খুলুন।

**খালি A4 ফর্ম:** Purchases → **Sample A4 form / নমুনা A4 ফর্ম** এখন থেকে হাত দিয়ে পূরণ করার খালি ফর্ম দেবে। নাম, তারিখ, জন্মতারিখ, ফোন/IMEI ও টাকার কোনো default থাকবে না। লোগো, ছাপানো ঘোষণার লেখা ও স্বাক্ষরের জায়গা থাকবে। বাটনের নতুন ফাইলের ঠিকানা `/samples/tech-trolley-purchase-blank-a4.pdf`; আগের sample ঠিকানাতেও একই খালি ফাইল থাকবে। ভবিষ্যতে আবার বানাতে `npm run build:shared` এবং `node scripts/generate-blank-purchase-form.mjs` চালাবেন, PDF এক পৃষ্ঠা ও সত্যিই খালি কি না দেখে commit/push করবেন। এটি frontend/static file update—নতুন migration বা Render manual deploy লাগবে না।

খালি ফর্মের update live হয়েছে: `4721779`, [CI সফল](https://github.com/asadbinjafor/TECH-TROLLY/actions/runs/41120107886)। Refresh দিয়ে বাটন চাপুন। Live download পরীক্ষা করা খালি PDF-এর সঙ্গে মিলেছে; API/database বদলায়নি।

**Android/iPhone ও RAM/Storage update (৩১ অক্টোবর):** New purchase ও ব্যক্তির কাছ থেকে ক্রয়ে ফোনের ধরন বাছুন; আসল Model নামও লিখবেন। Android হলে RAM 4/8/12/16 GB এবং Storage 64/128/256/512 GB বা 1/2 TB বাছুন। iPhone হলে RAM লাগবে না। New sale-এ এই বাছাইগুলো দিয়ে stock খুঁজবেন; নির্দিষ্ট stock বাছলে তার তথ্য আসবে। পুরোনো stock-এর ধরন দেওয়া না থাকলে Phone type খালি রেখে সেটি বাছুন, অথবা Inventory → Edit stock details দিয়ে সঠিক ধরন/RAM/Storage দিন। অনুমান করে পুরোনো তথ্য বদলানো হয়নি।

এই update এখন **live**, commit `ed3918c`; [CI সফল](https://github.com/asadbinjafor/TECH-TROLLY/actions/runs/41118444791)। স্বাভাবিক Git push → CI pass → Render startup runner **010_phone_type_and_ram.sql** চালিয়েছে। মোট **১০টি migration**, আগের মতো **১৯টি RLS table** আছে। Vercel/Render revision ও live PDF/হিসাব যাচাই হয়েছে; পুরোনো stock/লেনদেন অক্ষত। Supabase-এ হাতে SQL/reset নয়। ভবিষ্যৎ release-এর পরেও `/api/health` revision ও live ফল পরীক্ষা করবেন।

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

২০২৬-১১-০১ update: Owner-এর পছন্দ অনুযায়ী [cron-job.org → Cronjobs](https://console.cron-job.org/jobs)-এ দুটি enabled job আছে। দুটির Time zone **Asia/Dhaka**, method **GET**, URL `https://tech-trolley-internal-api.onrender.com/health`, timeout **30 seconds**। কোনো authentication, cookie, API key বা দোকানের password লাগে না।

| Job | Crontab expression | বাংলাদেশ সময় |
| --- | --- | --- |
| Tech Trolley — shop hours health | `*/5 9-23 * * *` | প্রতিদিন ৯:০০–২৩:৫৫, প্রতি ৫ মিনিটে |
| Tech Trolley — 08:50 and 08:55 warm-up | `50,55 8 * * *` | প্রতিদিন ৮:৫০ ও ৮:৫৫, দোকান খোলার আগে |

**Edit → Common** থেকে সময় বদলে Save করুন; **Advanced**-এ timezone ও GET মিলিয়ে নিন। বন্ধ রাখতে Enable job বন্ধ করে Save করুন। **History**-তে actual scheduled result এবং **Test run**-এ বর্তমান readiness দেখুন। HTTP 200-এর সঙ্গে JSON `status: "ok"` ও `Content-Type: application/json` মিলিয়ে নিন; Render loading HTML readiness নয়। প্রথম cold test বড় response-এর জন্য abort হয়েছিল; server প্রস্তুত হওয়ার পর একই scheduler-এর test **200 OK / 536 ms / JSON status ok** দেয়। ৩০ সেকেন্ডের বেশি cold start হলে প্রথম warm-up ব্যর্থ হতে পারে; পরের ৮:৫৫ check আবার চেষ্টা করে। ভবিষ্যতের uptime guarantee নয়।

আগের GitHub check এখন শুধু daytime fallback: UTC `2-59/5 3-17 * * *`, বাংলাদেশ সময় ৯:০২–২৩:৫৭। রাতের scheduled check বাদ গেছে। Configured পাঁচ মিনিটের বদলে দুটি GitHub run-এর মধ্যে প্রায় ছয় ঘণ্টা ব্যবধান পাওয়া গেছে, তাই নিয়মিত check-এর প্রধান ব্যবস্থা cron-job.org। চারটি Free service একই ৭৫০ ঘণ্টা ভাগ করে। ১৫ ঘণ্টা/দিনে ৩০ দিনের মাসে ৪৫০ ঘণ্টা; pre-warm ও idle tail মিলিয়ে প্রায় ৪৬০ ঘণ্টা হতে পারে। অন্য service, restart, manual checks ও দোকান বন্ধের পর traffic বাড়তি usage যোগ করবে। Quota নজরে রাখবেন; শেষ হলে সব Free web service suspend হতে পারে।

GitHub job দেরি করে শুরু হলে execution-time guard বাংলাদেশ সময় ৯:০০–২৩:৫৯-এর বাইরে scheduled probe skip করে। Explicit manual/push check recovery/release যাচাইয়ের জন্য বহাল। নিচের GitHub পরিচালনার নির্দেশনা বহাল; তার আগের সারাদিনের schedule-কে উপরের daytime সময় supersede করে।

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
### পুরো web form-এর layout আপডেট যাচাই

এই পরিবর্তন শুধু frontend-এর shared field/CSS ও screen markup-এ। Production branch-এ push করলে Vercel স্বাভাবিকভাবে deploy করবে; API dependency না বদলালে Render-এর আগের verified revision থাকাই ঠিক। Supabase-এ migration বা আলাদা কাজ নেই।

Deploy শেষে refresh করে New sale/Purchases/Settings খুলুন। Label-এর পাশে `(Optional)`/`(ঐচ্ছিক)`, সমান উচ্চতার box এবং নিজের box-এর নিচে warning/error থাকবে। ছোট screen বা সরু dialog-এ এক কলাম হওয়া স্বাভাবিক। Android নিলে RAM এবং iPhone নিলে RAM ছাড়া storage থাকবে; আগের payment/due নিয়ম বজায় আছে। [সম্পূর্ণ audit ও আগে/পরের screenshot](form-layout-audit.md) দেখুন। বাস্তব দোকানে নকল লেনদেন Confirm করে পরীক্ষা করবেন না।

### Back / Close-এর আপডেট যাচাই

এই পরিবর্তন frontend navigation/CSS-এ; production branch-এ push → CI → connected Vercel deploy হবে। API dependency ও migration না বদলালে Render/Supabase-এ আলাদা deployment লাগবে না। Deploy শেষে একবার refresh দিন।

Page-এর Back আগের app page-এ ফেরাবে; সরাসরি link খুললে Dashboard-এ যাবে। Mobile Workspace-এর উপরের বামমুখী arrow, menu-র বাইরে tap অথবা browser Back দিয়ে menu বন্ধ করুন। Form/রসিদের Close উপরে থাকবে; লম্বা form scroll করলেও চাপা যাবে। Nested dialog খোলা থাকলে browser Back আগে সেটি বন্ধ করবে। Review থেকে Back editing-এ ফেরাবে। অনিশ্চিত submission বন্ধ করে আবার খুললে আগের key/data থাকবে—নতুন করে একই বিক্রি/খরচ লিখবেন না; আগের status/retry নিয়ম অনুসরণ করুন। [অডিট ও ছবি](navigation-audit.md) দেখুন।
