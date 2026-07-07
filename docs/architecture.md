# معماری دبی‌پرو (DubaiPro Architecture)

## لایه‌بندی معماری

### 1. Presentation Layer (رابط کاربری)
- **Next.js App Router**: روتینگ سمت سرور و سمت کلاینت
- **React Components**: کامپوننت‌های Reusable در `components/`
- **Tailwind CSS**: استایل‌دهی
- **next-intl**: چندزبانه و RTL

#### ساختار کامپوننت‌ها
```
components/
├── admin/           # کامپوننت‌های پنل ادمین
├── auth/            # فرم‌های احراز هویت
├── cart/            # سبد خرید
├── checkout/        # تسویه حساب
├── products/        # نمایش محصولات
├── analytics/       # نمودارها و آمار
├── marketing/       # بنرها و پیکسل‌ها
├── experiments/     # A/B testing
└── ui/              # کامپوننت‌های پایه
```

### 2. API Layer (لایه API)
- **Next.js API Routes**: RESTful endpoints در `app/api/`
- **Validation**: اعتبارسنجی ورودی‌ها
- **Error Handling**: مدیریت خطاها
- **Authentication**: JWT-based auth middleware

#### ساختار API
```
app/api/
├── account/         # مدیریت حساب کاربر
├── admin/           # APIهای ادمین
├── address/         # مدیریت آدرس‌ها
├── cart/            # سبد خرید
├── products/        # محصولات
├── search/          # جستجو
└── ...
```

### 3. Business Logic Layer (منطق تجاری)
- **Lib Services**: منطق سمت سرور در `lib/`
- **Prisma Client**: ORM برای دیتابیس
- **Business Rules**: قوانین تجاری

#### سرویس‌های اصلی
```
lib/
├── auth/            # احراز هویت (JWT, password, RBAC)
├── payments/        # درگاه‌های پرداخت
├── shipping/        # محاسبه هزینه ارسال
├── currency/        # تبدیل ارز
├── automation/      # اتوماسیون مارکتینگ
├── experiments/     # A/B testing
├── marketing/       # سگمنت‌بندی و پیکسل‌ها
├── cart/            # منطق سبد خرید
├── orders/          # مدیریت سفارشات
└── ...
```

### 4. Data Layer (لایه داده)
- **PostgreSQL**: دیتابیس اصلی
- **Prisma ORM**: ORM و migrations
- **Connection Pool**: مدیریت اتصال با pg Pool

#### مدل‌های دیتابیس
```
prisma/schema.prisma
├── User             # کاربران
├── Product          # محصولات
├── Order            # سفارشات
├── Cart             # سبد خرید
├── Coupon           # کوپن‌ها
├── Payment          # پرداخت‌ها
├── AutomationRule   # قوانین اتوماسیون
├── Experiment       # A/B tests
└── ...              # مدل‌های دیگر
```

## جریان داده (Data Flow)

### 1. جریان احراز هویت
```
User Request
    ↓
Middleware (verify JWT)
    ↓
API Route
    ↓
Auth Service (RBAC check)
    ↓
Business Logic
    ↓
Prisma Query
    ↓
Database
```

### 2. جریان سفارش
```
User submits order
    ↓
POST /api/orders
    ↓
Order Service (validate, calculate)
    ↓
Payment Gateway (Mellat/Zarinpal/Stripe)
    ↓
Payment Webhook
    ↓
Update Order Status
    ↓
Send Automation (Email/WhatsApp)
    ↓
Update User Metrics
```

### 3. جریان A/B Testing
```
Visitor visits page
    ↓
Middleware (generate visitor ID)
    ↓
getActiveVariant() (hash visitor ID)
    ↓
Render variant
    ↓
Track impression/click/conversion
    ↓
Experiment Event Log
    ↓
Stats calculation
```

## Security Architecture

### Authentication
- **JWT Tokens**: Access tokens با expiration
- **HTTP-only Cookies**: ذخیره امن توکن‌ها
- **Password Hashing**: bcrypt برای رمز عبور
- **Password Reset**: توکن‌های یک‌بار مصرف

### Authorization
- **RBAC**: Role-Based Access Control
- **Middleware Guards**: محافظت از routes حساس
- **API Route Guards**: check role قبل از اجرا

### Data Protection
- **SQL Injection Prevention**: Prisma ORM
- **CSRF Protection**: Next.js built-in
- **XSS Protection**: React escaping
- **Rate Limiting**: برای API حساس

### Privacy
- **GDPR Consent**: Consent banner با tracking
- **Data Minimization**: فقط داده‌های لازم
- **Cookie Consent**: مدیریت cookieها

## i18n Architecture

### Locale Detection
```
Request URL
    ↓
Extract locale from path (/en, /fa, /ar, /ur)
    ↓
next-intl middleware
    ↓
Set locale context
    ↓
Render with translated messages
```

### RTL Support
- **RTL Locales**: fa, ar, ur
- **Direction Attribute**: dir="rtl" یا dir="ltr"
- **CSS Mirroring**: Tailwind RTL support

### Message Files
```
messages/
├── en.json          # English
├── fa.json          # فارسی
├── ar.json          # عربی
└── ur.json          # اردو
```

## Performance Architecture

### Caching Strategy
- **Next.js Cache**: ISR برای صفحات استاتیک
- **Prisma Query Cache**: Connection pooling
- **Image Optimization**: Sharp برای تصاویر

### Database Optimization
- **Indexes**: ایندکس‌های استراتژیک
- **Query Optimization**: Prisma include/select
- **Connection Pool**: pg Pool برای مدیریت اتصال

### Code Splitting
- **Dynamic Imports**: lazy loading کامپوننت‌ها
- **Route-based Splitting**: Next.js automatic
- **Component Splitting**: React.lazy

## Scalability Architecture

### Horizontal Scaling
- **Stateless API**: Next.js API routes
- **Database Connection Pool**: مدیریت اتصال
- **Session Storage**: HTTP-only cookies

### Vertical Scaling
- **Database Indexing**: بهینه‌سازی queryها
- **Query Optimization**: Prisma include/select
- **Caching**: ISR و query cache

## Monitoring & Logging

### Error Tracking
- **Prisma Error Logging**: development و production
- **API Error Handling**: structured errors
- **Client Error Logging**: error boundaries

### Analytics
- **User Metrics**: lifetime value, order count
- **Conversion Tracking**: A/B test events
- **Marketing Analytics**: campaign performance

## Deployment Architecture

### Environment Variables
```
DATABASE_URL
JWT_SECRET
NEXT_PUBLIC_SITE_URL
# Gateway credentials
MELLAT_TERMINAL_ID
ZARINPAL_MERCHANT_ID
STRIPE_SECRET_KEY
# etc.
```

### Build Process
```
npm run build
    ↓
Next.js Production Build
    ↓
Prisma Generate
    ↓
Static Assets Optimization
    ↓
Ready for deployment
```

### Deployment Options
- **Vercel**: Recommended برای Next.js
- **Docker**: Containerization
- **Node.js Server**: PM2 یا similar
