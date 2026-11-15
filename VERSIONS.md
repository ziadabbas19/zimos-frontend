# النسخ المحفوظة — Saved versions

قبل أي تعديل كبير بنحفظ نسخة من الكود زي ما هو، علشان نقدر نرجع لها في أي وقت، حتى بعد سنين.

كل نسخة محفوظة عبارة عن **فرع (branch) على GitHub** اسمه بيبدأ بـ `snapshot/`، وبعده التاريخ ووصف التعديل. الفرع ده صورة ثابتة من الكود في اليوم ده: ما حدش بيشتغل عليه، فما بيتغيرش.

| الفرع | التاريخ | فيه إيه |
| --- | --- | --- |
| `snapshot/2026-11-14-before-landing-redesign` | 14 نوفمبر 2026 | كل حاجة قبل تعديل صفحة الهبوط وصفحات الدخول والتسجيل (main عند `d077d3e`). |
| `snapshot/2026-11-15-before-dashboard-redesign` | 15 نوفمبر 2026 | لوحة التحكم قبل الشريط اللي تحت والأقسام الملوّنة والخط الجديد وصفحة «خطتي» الجديدة. صفحة الهبوط هنا بشكلها الجديد بالباقات الزرقا (main عند `a8f7c4f`). |
| `snapshot/2026-11-15-before-stores-page` | 15 نوفمبر 2026 | لوحة التحكم الجديدة (الشريط اللي تحت، الخلفيات، الرئيسية الجديدة) قبل تعديل صفحة المتاجر وصور القوالب (main عند `19aaf0a`). |

## إزاي ترجع لنسخة

**1. الأسرع: من Railway (دقايق، من غير ما تلمس الكود)**
- افتح الخدمة على Railway، وبعدين Settings، ثم Source، وغيّر الفرع من `main` لفرع النسخة اللي عايزها، واعمل Deploy.
- أو من Deployments: اختار نشر (deployment) قديم واعمل Redeploy، طول ما Railway لسه محتفظ بيه.
- ولما تحب ترجع للجديد: رجّع الفرع لـ `main`.

**2. نهائي: في الكود**
- على GitHub افتح الـ Pull Request اللي عمل التعديل، ودوس **Revert**، وبعدين ادمج الـ Pull Request اللي بيطلع. كده `main` نفسه يرجع زي ما كان، وكل التاريخ بيفضل محفوظ.

**3. جزء واحد بس** (مثلًا لوحة التحكم ترجع، والموقع يفضل جديد):

```bash
git checkout snapshot/2026-11-15-before-dashboard-redesign -- apps/merchant-dashboard packages/ui
```

وبعدها اعمل commit وpull request عادي.

## علشان النسخ ما تتمسحش بالغلط

- على GitHub: Settings، ثم Rules، ثم Rulesets (أو Branches)، واعمل قاعدة على `snapshot/*` تمنع الحذف والـ force push.
- وممكن كمان تعمل لكل نسخة **Release** من صفحة Releases باسم التاريخ: بتبقى ظاهرة في صفحة الريبو، وتقدر تنزّلها كملف zip.

## نسخة جديدة

قبل كل تعديل كبير: فرع جديد بالاسم `snapshot/<التاريخ>-before-<التعديل>` من `main` زي ما هو، وسطر جديد في الجدول اللي فوق.

---

**English, in short.** Each saved version is a `snapshot/<date>-before-<change>` branch on GitHub, frozen at that day's `main`. To go back: point the Railway service at the snapshot branch (Settings → Source) or redeploy an older deployment; or revert the change's pull request on GitHub; or restore one app's folders with `git checkout <snapshot> -- <paths>`. Protect `snapshot/*` from deletion with a branch rule, and optionally publish each as a Release.
