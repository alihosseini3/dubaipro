# تسک‌های فعلی دبی‌پرو

## وضعیت کلی
پروژه در حال توسعه فعال است. این فایل برای پیگیری تسک‌های در حال انجام و آینده استفاده می‌شود.

## تسک‌های در حال انجام

### 1. تکمیل مستندات پروژه ✅
- **وضعیت**: تمام شده
- **توضیح**: ایجاد فایل‌های مستندات در پوشه docs/
- **فایل‌ها**:
  - `project-summary.md`: خلاصه کلی پروژه
  - `architecture.md`: معماری سیستم
  - `api-routes.md`: لیست کامل API routes
  - `database.md`: مدل‌های دیتابیس
  - `current-tasks.md`: این فایل

## تسک‌های پیشنهادی برای توسعه

### اولویت بالا

#### 1. بهبود UI پنل ادمین
- **توضیح**: بهبود رابط کاربری پنل ادمین برای تجربه بهتر
- **جزئیات**:
  - اضافه کردن loading states
  - بهبود error handling
  - اضافه کردن confirmation dialogs برای عملیات حساس
  - بهبود responsive design

#### 2. بهینه‌سازی Performance
- **توضیح**: بهبود سرعت لود و کارایی
- **جزئیات**:
  - Implement ISR برای صفحات استاتیک
  - بهینه‌سازی queryهای Prisma
  - اضافه کردن caching برای APIهای پرکاربرد
  - Image optimization با Next.js Image

#### 3. بهبود SEO
- **توضیح**: بهبود ranking موتورهای جستجو
- **جزئیات**:
  - اضافه کردن structured data (JSON-LD) برای محصولات
  - بهبود meta tags برای صفحات محصول
  - Implement sitemap.xml dynamic
  - بهبود internal linking

#### 4. Testing
- **توضیح**: اضافه کردن testها
- **جزئیات**:
  - Unit tests برای lib services
  - Integration tests برای API routes
  - E2E tests با Playwright
  - Test coverage reporting

### اولویت متوسط

#### 5. بهبود سیستم RFQ
- **توضیح**: بهبود درخواست قیمت برای B2B
- **جزئیات**:
  - اضافه کردن chat برای مذاکره قیمت
  - اضافه کردن document upload
  - بهبود notification system
  - RFQ analytics در پنل ادمین

#### 6. بهبود سیستم مزایده
- **توضیح**: بهبود سیستم auction
- **جزئیات**:
  - Real-time bid updates با WebSocket
  - اضافه کردن countdown timer
  - بهبود notification برای bidها
  - Auction history و analytics

#### 7. بهبود مارکتینگ
- **توضیح**: بهبود قابلیت‌های مارکتینگ
- **جزئیات**:
  - Email template builder
  - WhatsApp message templates
  - Advanced segmentation
  - Campaign scheduling و automation

#### 8. بهبود Analytics
- **توضیح**: بهبود گزارش‌گیری و آمار
- **جزئیات**:
  - Real-time dashboard
  - Custom reports
  - Export functionality
  - Advanced filters

### اولویت پایین

#### 9. Mobile App
- **توضیح**: توسعه اپلیکیشن موبایل
- **جزئیات**:
  - React Native یا Expo
  - Push notifications
  - Offline support
  - Biometric auth

#### 10. AI Features
- **توضیح**: اضافه کردن قابلیت‌های هوش مصنوعی
- **جزئیات**:
  - Product recommendations
  - Price prediction
  - Chatbot برای پشتیبانی
  - Image recognition برای products

## Bug Fixes معروف

### 1. Fix RTL Layout Issues
- **مشکل**: Layout در زبان‌های RTL به درستی نمایش داده نمی‌شود
- **راه‌حل**: بهبود Tailwind RTL support و testing در fa, ar, ur

### 2. Fix Coupon Validation
- **مشکل**: بعضی کوپن‌ها به درستی اعمال نمی‌شوند
- **راه‌حل**: بهبود validation logic در lib/coupon/service.ts

### 3. Fix Shipping Calculator
- **مشکل**: هزینه ارسال برای بعضی مناطق نادرست محاسبه می‌شود
- **راه‌حل**: بهبود rule engine در lib/shipping/calculator.ts

## به‌روزرسانی‌های اخیر

### نسخه 0.1.0
- اضافه کردن سیستم A/B testing
- بهبود سیستم مارکتینگ و automation
- اضافه کردن سیستم وابستگی و کمیسیون
- بهبود multi-currency support

## Dependencies

### Dependencies اصلی
- Next.js 15.5.15
- React 19.0.0
- Prisma 7.8.0
- PostgreSQL
- TypeScript 5.7.2
- Tailwind CSS 3.4.17
- next-intl 4.9.1

### Dependencies اضافی
- Sharp (image processing)
- Nodemailer (email)
- pg (PostgreSQL client)

## محیط توسعه

### Required
- Node.js (latest LTS)
- PostgreSQL 14+
- npm یا yarn

### Environment Variables
```
DATABASE_URL
JWT_SECRET
NEXT_PUBLIC_SITE_URL
# Payment gateways
MELLAT_TERMINAL_ID
MELLAT_USERNAME
MELLAT_PASSWORD
ZARINPAL_MERCHANT_ID
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
# Email
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASSWORD
```

## Scriptهای مفید

```bash
# Development
npm run dev

# Build
npm run build

# Database
npm run db:generate
npm run db:migrate
npm run db:studio
npm run db:seed

# Lint
npm run lint
```

## نکات مهم برای توسعه‌دهندگان

1. **Code Style**: از ESLint و Prettier استفاده کنید
2. **Commits**: از conventional commits استفاده کنید (feat:, fix:, docs:, etc.)
3. **Branching**: از Git flow استفاده کنید (main, develop, feature/*)
4. **Testing**: قبل از merge، testها را اجرا کنید
5. **Documentation**: تغییرات مهم را در مستندات به‌روز کنید

## منابع

- **Next.js Docs**: https://nextjs.org/docs
- **Prisma Docs**: https://www.prisma.io/docs
- **Tailwind Docs**: https://tailwindcss.com/docs
- **next-intl Docs**: https://next-intl-docs.vercel.app

## پشتیبانی

برای سوالات و مشکلات:
- بررسی docs/
- بررسی code comments
- بررسی GitHub issues (در صورت وجود)
