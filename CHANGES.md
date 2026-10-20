# HaramBlur Improvements Package

**بسته بهبودهای HaramBlur** — ۷ تغییر آماده‌ی PR، ساخته‌شده روی تحلیل کد v0.2.6 (اکتبر ۲۰۲۶)

---

## What's in this package | محتوای این بسته

```
haramblur-improvements/
├── CHANGES.md            ← this file (start here | از اینجا شروع کن)
├── patches/              ← one git patch per PR-ready change (یه پچ برای هر PR)
│   ├── 01-feat-i18n-persian-localization.patch
│   ├── 02-fix-settings-dedup-and-language-fallback.patch
│   ├── 03-fix-whitelist-hostname-matching.patch
│   ├── 04-perf-video-imagebitmap-structured-clone.patch
│   ├── 05-chore-remove-orphan-model-shard.patch
│   ├── 06-ci-github-actions.patch
│   └── 07-feat-experimental-bg-image-detection.patch
└── improved-files/       ← final state of every changed file (وضعیت نهایی فایل‌ها)
```

All patches were built and verified: `npm run build` ✅ `prettier --check` ✅

---

## How to apply | نحوهٔ اعمال

**Option A — apply patches onto your fork (recommended):**

```bash
# 1. fork alganzory/HaramBlur on GitHub, then:
git clone https://github.com/<your-username>/HaramBlur.git
cd HaramBlur

# 2. create a branch per change (one PR per patch!)
git checkout -b feat/persian-localization
git apply path/to/01-feat-i18n-persian-localization.patch
git add -A && git commit -m "feat(i18n): add Persian (fa) localization"
git push -u origin feat/persian-localization
# 3. open a PR on GitHub from that branch
```

**Option B — copy files manually | کپی دستی فایل‌ها:**
Copy files from `improved-files/` over your clone. Note: patch 05 also deletes
`src/assets/models/nsfwjs/group1-shard1of1` — remove that file manually (`git rm`).

**Test locally | تست محلی:**
```bash
npm install
npm run build
# Chrome → chrome://extensions → Developer mode → Load unpacked → select repo folder
```

---

## The 7 changes | شرح ۷ تغییر

### 01 — Persian localization | فارسی‌سازی
`feat(i18n)` · **Impact: Medium · Effort: ~1h · First PR candidate!**

Adds a complete `fa` dictionary to `translations.js`, registers `fa: "rtl"`
in `HB_TRANSLATIONS_DIR`, and adds the فارسی option to the popup language
select. Persian speakers are a huge part of this extension's audience but
had no UI language.

**فارسی:** دیکشنری کامل فارسی + راست‌چین (RTL) + گزینه «فارسی» در منوی زبان پاپ‌آپ. این ساده‌ترین و بی‌خطرترین تغییر بسته‌ست و **بهترین اولین PR** برای شروع شهرت شما در این پروژه است.

---

### 02 — Settings dedup + language fallback | یکسان‌سازی تنظیمات
`fix(settings)` · **Impact: Medium · Effort: ~2h**

Three fixes in one theme:
- `background.js` now imports `DEFAULT_SETTINGS` from `constants.js` instead of
  keeping a drifted private copy (the copy was missing `language`, and
  `constants.js` was missing `whitelist`). The service worker is now an ES
  module (`"type": "module"` in manifest).
- `popup.js` falls back to English when the stored/browser language is not
  supported. Previously a browser set to de/fr/es would hit
  `Object.keys(undefined)` and **break the whole popup**.
- Language select defaults to `en` when unset.

**فارسی:** تنظیمات پیش‌فرض در دو فایل مختلف تکرار شده بود و بین‌شان اختلاف (drift) ایجاد شده بود. حالا یک منبع واحد داریم. ضمناً یک باگ واقعی رفع شد: اگر زبان مرورگر کاربر آلمانی/فرانسوی/... بود، کل پاپ‌آپ کرش می‌کرد!

---

### 03 — Whitelist hostname matching | اصلاح منطق لیست سفید
`fix(whitelist)` · **Impact: High · Effort: ~3h**

The old pattern `hostname.split("www.")?.[1]` broke on hostnames containing
`www.` anywhere (e.g. `sub.www.example.com`) and never matched subdomains.
New `normalizeHostname()` + `isWhitelisted()` in `helpers.js`: lowercase,
trim, strip only a *leading* `www.`, and match the exact host **or any
subdomain** of a whitelisted entry. Backward compatible with previously
stored entries.

**فارسی:** الگوی قبلی هر چیزی که قبل از اولین «www.» می‌ومد رو حذف می‌کرد و دامنه‌های فرعی (subdomain) رو هم تشخیص نمی‌داد. حالا اگر `example.com` در لیست سفید باشه، `sub.example.com` هم شامل می‌شه — مثل رفتار استاندارد افزونه‌هایی مثل uBlock.

---

### 04 — Video frames via ImageBitmap ⭐ | خط لوله سریع فریم ویدیو
`perf(video)` · **Impact: High · Effort: ~1 day**

The flagship performance change. Previously every video frame traveled:
canvas → **JPEG encode** (q 0.6) → blob objectURL → `sendMessage` →
**`<img>` decode** → `tf.browser.fromPixels` — a full encode/decode round
trip per frame, at up to 25 fps per playing video, plus JPEG artifacts
feeding the classifiers.

Now:
- `manifest.json` opts into `"message_serialization": "structured_clone"`
  (new in **Chrome 148**, April 2026).
- Feature detection via `chrome.runtime.getManifest().message_serialization`
  (older Chrome drops unknown keys → the probe returns undefined).
- Fast path sends the frame as a **structured-cloned ImageBitmap** — zero
  encode, zero decode; the bitmap is closed in the response callback.
- Blob-URL fallback path is kept byte-for-byte for older browsers.
- Bonus bug fix: `runDetection` no longer clears `activeFrame` mid-flight
  (previously allowed overlapping detections through one shared `<img>`).

**فارسی:** مهم‌ترین تغییر کارایی. قبلاً هر فریم ویدیو (تا ۲۵ فریم بر ثانیه!) کد و دیکد JPEG کامل می‌شد فقط برای اینکه از content script به offscreen برسه. حالا در کروم ۱۴۸+ فریم به‌صورت ImageBitmap با structured clone — بدون هیچ کد/دیکدی — منتقل می‌شه. در نسخه‌های قدیمی‌تر همان مسیر قبلی استفاده می‌شه، پس هیچ خطری نیست. **نکته برای PR:** قبل از ارسال، عدد بنچمارک before/after از DevTools Performance ضمیمه کن — بازبین‌ها عاشق عدد می‌شن.

---

### 05 — Remove orphan model shard | حذف فایل یتیم
`chore` · **Impact: Small · Effort: 15min**

`src/assets/models/nsfwjs/group1-shard1of1` (2.6 MB!) is referenced neither
by `model.json` (which points to `group1-shard{1..5}of5`) nor by any code.
Accidental commit; needlessly inflates the package.

**فارسی:** یه فایل ۲.۶ مگابایتی بی‌صاحب که جایی ارجاعی بهش نیست و حجم بسته افزونه رو بی‌دلیل زیاد می‌کنه. حذفش کن — کوچیک‌ترین PR ممکن ولی نشون‌دهنده دقت توئه.

---

### 06 — CI: GitHub Actions | استقرار CI
`ci` · **Impact: Medium · Effort: ~2h**

`.github/workflows/ci.yml`: on every push/PR → `npm ci` →
`prettier --check` → `vite build` → verify `dist/content.js` exists.
Adds `format` / `format:check` npm scripts. Gives maintainers a green
check-mark on every future PR — infrastructure every healthy project needs.

**فارسی:** یه workflow ساده که هر PR رو در ۳۰ ثانیه می‌سازه و سبز/قرمز نشون می‌ده. برای پروژه‌ای که می‌خواد فعال بشه، زیرساخت اولیه‌ست. اکشن‌های `actions/checkout@v4` و `setup-node@v4` استاندارد و امن هستن.

---

### 07 — Background-image detection (EXPERIMENTAL) | تشخیص background-image (آزمایشی)
`feat(experimental)` · **Impact: High (if landed) · Effort: ~1 week to production**

Draft toward issue **#190**: thumbnails rendered as CSS `background-image`
(Google Images grid, Twitter timelines, e-commerce listings) are currently
**never checked** by HaramBlur. New self-contained `modules/bgImages.js`:

- scans mutated nodes for elements with inline `background-image`
- extracts `url(...)`, sends it through the existing `imageDetection` pipeline
- toggles a `.hb-bg-blur` filter class based on the verdict
- WeakMap prevents re-detecting unchanged elements

Documented v1 limits: inline styles only; filter blurs whole element
(including overlaid text). **Before merging upstream:** gate behind a
settings toggle (default off). Kept isolated → trivial to revert.

**فارسی:** پیش‌نویس اولیه برای اینسوی #190 — تصاویری که به‌جای تگ `<img>` به‌صورت background در CSS رندر می‌شن (مثل شبکه نتایج گوگل‌ایمیج) الان اصلاً بررسی نمی‌شن. ماژول جداست، یک‌خط به observer اضافه می‌شه، و برگشت‌پذیره. **قبل از merge واقعی باید یه سوییچ تنظیمات براش اضافه بشه (پیش‌فرض خاموش).** این همان «هفته ۳» نقشه راه PDF است.

---

## PR strategy | استراتژی ارسال

1. **Issue first:** open a short issue per change ("Add Persian localization",
   "Fix whitelist subdomain matching"...) referencing this analysis. Wait a
   few days — the repo has been quiet since July 2024 (issues #188/#213 ask
   if it's still maintained). If no response, PR anyway with
   "closes #XYZ, happy to adjust".
2. **One PR per patch.** Small PRs get reviewed; big PRs rot.
3. **Order (easiest → flagship):** 01 → 05 → 02 → 03 → 06 → 04 → 07
4. **Patch 04 & 07:** attach before/after benchmarks and a short screen
   recording — they touch the hot path, reviewers will ask.
5. AGPL-3.0: your contributions are AGPL too. All good — just don't copy
   proprietary code in.

**فارسی:** برای هر تغییر اول یک Issue کوتاه باز کن. چون مخزن از ژوئیه ۲۰۲۴ فعال نبوده، صبور باش؛ اگر جواب نگرفتی PR بفرست. هر پچ یک PR جدا. ترتیب پیشنهادی از آسان به پرچم‌دار: ۰۱ → ۰۵ → ۰۲ → ۰۳ → ۰۶ → ۰۴ → ۰۷.

---

*Built from commit `f47000e` (v0.2.6, 2024-07-07). Verified: build ✅ format ✅ — October 2026.*
