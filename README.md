# نظام الإدارة الجامعية الذكي (UAMS) - Backend API
> **University Academic Management System - Backend RESTful Services**  
> المنصة المركزية لإدارة العمليات الأكاديمية، الحضور الذكي بـ QR، الواجبات، الدرجات، الهوية الرقمية، وسجل التدقيق الأمني.

---

## 📌 نبذة عن النظام (Overview)

نظام إدارة جامعي متكامل (Enterprise-grade) مبني على معمارية طبقية نظيفة (Layered MVC Architecture) بالاعتماد على **Node.js** و **Express** وقاعدة بيانات **MongoDB**.  
يوفر المنظومة تحكماً دقيقاً بالصلاحيات بحسب الأدوار الأكاديمية (RBAC):
- **الإدارة ورئاسة القسم (ADMIN)**: التحكم بالأقسام، المواد، الشعب، توزيع الأساتذة، إصدار التعميمات، ومراقبة سجل التدقيق الأمني.
- **الكادر التدريسي (DOCTOR)**: إدارة جلسات الحضور الحي برمز QR الديناميكي، تصحيح الواجبات، رصد درجات الفصول والامتحانات، رفع الملازم، ومناقشة أسئلة الطلبة.
- **الطلبة (STUDENT)**: تسجيل الحضور الآمن، الهوية الجامعية الرقمية، استلام ومتابعة المهام والملازم، رصد السعي، وتلقي الإشعارات الفورية.

---

## 🛠 التقنيات المستخدمة (Tech Stack)

* **Runtime:** Node.js (v18+)
* **Framework:** Express.js (v5.x)
* **Database:** MongoDB مع Mongoose ORM
* **Authentication & Security:** 
  * JSON Web Tokens (Access + Refresh Token Rotation)
  * BcryptJS (Password Hashing)
  * Helmet (HTTP Security Headers)
  * CORS (Whitelist Domain Protection)
  * Express Rate Limit (Brute-force Mitigation)
  * Express Mongo Sanitize & XSS Clean
* **Engines & Utilities:**
  * QRCode & UUID (Dynamic Attendance Life-cycle)
  * ExcelJS (Academic Reports & Grade Export)
  * Multer (Protected File & Media Storage)
  * DayJS & Joi (Data Validation & Schedule Handling)

---

## 📂 هيكلة المشروع (Project Structure)

```text
UAMS/
├── config/              # إعدادات قاعدة البيانات والاتصالات
├── controllers/         # وحدات منطق الأعمال لكافة الخدمات الأكاديمية
├── middlewares/         # برمجيات التحقق من الصلاحيات والأمان والملفات
├── models/              # نماذج Mongoose وقواعد الفحص والعلاقات
├── routes/              # مسارات الـ API المحمية بنظام RBAC
├── scripts/             # سكريبتات تهيئة وبذر البيانات الأولية (Seeder)
├── services/            # الخدمات المساندة (توليد الرموز، التشفير)
├── uploads/             # مجلد تخزين المستندات والملازم المرفوعة
├── utils/               # أدوات التنسيق والاستجابة الموحدة
├── .env.example         # نموذج المتغيرات البيئية للمشروع
├── .gitignore           # استثناء ملفات البيئة والمجلدات المؤقتة
├── package.json         # توصيف الحزم والاعتماديات
└── server.js            # نقطة انطلاق الخادم والتهيئة المركزية
```

---

## 🚀 التثبيت والتشغيل (Getting Started)

### 1. استنساخ المستودع (Clone Repository)
```bash
git clone https://github.com/USERNAME/uams-backend.git
cd uams-backend
```

### 2. تثبيت الحزم (Install Dependencies)
```bash
npm install
```

### 3. إعداد المتغيرات البيئية (Environment Configuration)
قم بنسخ ملف النموذج `.env.example` إلى `.env` وتعديل القيم بما يناسب بيئة عملك:
```bash
cp .env.example .env
```
تأكد من تحديد:
- `MONGO_URI`: رابط الاتصال بقاعدة بيانات MongoDB (محلياً أو عبر Atlas).
- `JWT_SECRET` و `JWT_REFRESH_SECRET`: مفاتيح تشفير الجلسات.
- `PORT`: منفذ الخادم (الافتراضي: 5000).

### 4. بذر البيانات الأكاديمية الأولية (Database Seeding)
لتجهيز حسابات الإدارة، الأساتذة، الطلبة، والمقررات والشعب التجريبية:
```bash
npm run seed
```

### 5. تشغيل الخادم (Run Server)
* **في بيئة التطوير (Development with Nodemon):**
  ```bash
  npm run dev
  ```
* **في بيئة الإنتاج (Production):**
  ```bash
  npm start
  ```

الخادم يعمل افتراضياً على الرابط: `http://localhost:5000`

---

## 📡 مسارات الـ API الرئيسية (API Endpoints)

| المسار الأساسي | الوصف | الصلاحيات المطلوبة |
| :--- | :--- | :--- |
| `/api/auth` | تسجيل الدخول، تجديد الجلسات، واسترجاع الملف الشخصي | متاح للجميع / مستخدم مسجل |
| `/api/academic` | الأقسام، المناهج، المقررات، الشعب، وتوزيع الكادر | ADMIN / مسجل |
| `/api/attendance` | توليد رمز QR الحي، فحص الموقع، وتسجيل حضور الطالب | DOCTOR / STUDENT |
| `/api/assignments` | طرح الواجبات، تسليم الحلول، والتصحيح ورصد التقييمات | DOCTOR / STUDENT |
| `/api/exams` | جدولة الامتحانات ورصد درجات الفصول والسعي السنوي | DOCTOR / STUDENT |
| `/api/files` | رفع وتنزيل الملازم الدراسية والملفات المحمية | DOCTOR / STUDENT |
| `/api/questions` | حائط المناقشات والاستفسارات التفاعلية للشعبة | DOCTOR / STUDENT |
| `/api/announcements`| التعميمات والقرارات الإدارية وتوجيهات الأقسام | ADMIN / للجميع |
| `/api/notifications`| مركز الإشعارات الأكاديمية وتحديث حالة القراءة | مسجل (جميع الأدوار) |
| `/api/digital-id` | الهوية الرقمية الجامعية المشفرة وتجديد التوكن | STUDENT / إدارة |
| `/api/admin/audit-logs`| سجل الرقابة الأمنية وعناوين IP والحركات الحساسة | ADMIN فقط |

---

## 🔒 معايير الأمان (Security Architecture)

1. **فصل الصلاحيات (Least Privilege & Server Verification):** لا يتم الاعتماد على واجهة المستخدم، فكل عملية حساسة تخضع لفحص دور المستخدم وتطابق تسجيله في الشعبة على مستوى الخادم.
2. **رموز الحضور المؤقتة (Dynamic QR):** تشفير الرمز وتجديده دورياً مع بصمة الجهاز لمنع تداول الرموز بين الطلبة خارج القاعة.
3. **سجل التدقيق (Audit Trail):** تسجيل كافة عمليات الدخول، التعديلات الأكاديمية، وعناوين IP في سجل غير قابل للتعديل العشوائي.

---

## 📄 الترخيص (License)
هذا المشروع مطور لأغراض التطوير الأكاديمي والجامعي - جميع الحقوق محفوظة.
