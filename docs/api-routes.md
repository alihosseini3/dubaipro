# API Routes دبی‌پرو

## ساختار کلی
```
app/api/
├── account/         # مدیریت حساب کاربر
├── admin/           # پنل ادمین
├── address/         # مدیریت آدرس‌ها
├── cart/            # سبد خرید
├── products/        # محصولات
├── search/          # جستجو
└── ...
```

## Account API

### GET /api/account
- **توضیح**: دریافت اطلاعات کاربر لاگین شده
- **Auth**: Required (USER, ADMIN, SELLER, SUPPLIER)
- **Response**: `{ id, name, email, role, referralCode, ... }`

### PUT /api/account
- **توضیح**: به‌روزرسانی پروفایل کاربر
- **Auth**: Required
- **Body**: `{ name, email, ... }`

### GET /api/account/referral
- **توضیح**: دریافت کد وابستگی کاربر
- **Auth**: Required
- **Response**: `{ referralCode, referralLink, stats }`

## Address API

### GET /api/address
- **توضیح**: لیست آدرس‌های کاربر
- **Auth**: Required
- **Response**: `[{ id, fullName, phone, country, city, ... }]`

### POST /api/address
- **توضیح**: افزودن آدرس جدید
- **Auth**: Required
- **Body**: `{ fullName, phone, country, city, addressLine, postalCode, isDefault }`

### PUT /api/address/[id]
- **توضیح**: ویرایش آدرس
- **Auth**: Required
- **Body**: همان فیلدهای POST

### DELETE /api/address/[id]
- **توضیح**: حذف آدرس
- **Auth**: Required

### PUT /api/address/[id]/default
- **توضیح**: تنظیم آدرس پیش‌فرض
- **Auth**: Required

## Admin API

### Analytics

#### GET /api/admin/analytics
- **توضیح**: آمار کلی سیستم
- **Auth**: ADMIN only
- **Response**: `{ totalProducts, totalOrders, totalUsers, revenue, ... }`

#### GET /api/admin/analytics/sales
- **توضیح**: آمار فروش
- **Auth**: ADMIN only
- **Query**: `startDate`, `endDate`
- **Response**: `{ dailySales, topProducts, ... }`

#### GET /api/admin/analytics/customers
- **توضیح**: آمار مشتریان
- **Auth**: ADMIN only
- **Response**: `{ newCustomers, returningCustomers, segments }`

### Categories

#### GET /api/admin/categories
- **توضیح**: لیست دسته‌بندی‌ها
- **Auth**: ADMIN only
- **Response**: `[{ id, name, slug, parentId, sortOrder, ... }]`

#### POST /api/admin/categories
- **توضیح**: ایجاد دسته‌بندی جدید
- **Auth**: ADMIN only
- **Body**: `{ name, slug, parentId, icon, imageUrl, description, sortOrder }`

#### PUT /api/admin/categories/[id]
- **توضیح**: ویرایش دسته‌بندی
- **Auth**: ADMIN only

#### DELETE /api/admin/categories/[id]
- **توضیح**: حذف دسته‌بندی
- **Auth**: ADMIN only

#### PUT /api/admin/categories/[id]/attributes
- **توضیح**: به‌روزرسانی attributes دسته‌بندی
- **Auth**: ADMIN only
- **Body**: `{ attributeIds: [] }`

#### PUT /api/admin/categories/[id]/filter-config
- **توضیح**: تنظیم فیلترهای دسته‌بندی
- **Auth**: ADMIN only

#### POST /api/admin/categories/reorder
- **توضیح**: تغییر ترتیب دسته‌بندی‌ها
- **Auth**: ADMIN only
- **Body**: `{ categoryIds: [] }`

### Coupons

#### GET /api/admin/coupons
- **توضیح**: لیست کوپن‌ها
- **Auth**: ADMIN only
- **Query**: `page`, `limit`, `status`

#### POST /api/admin/coupons
- **توضیح**: ایجاد کوپن جدید
- **Auth**: ADMIN only
- **Body**: `{ code, type, value, minOrderAmount, usageLimit, expiresAt, appliesTo, categoryId, productId, userId, ... }`

#### PUT /api/admin/coupons/[id]
- **توضیح**: ویرایش کوپن
- **Auth**: ADMIN only

#### DELETE /api/admin/coupons/[id]
- **توضیح**: حذف کوپن
- **Auth**: ADMIN only

#### GET /api/admin/coupons/[id]/stats
- **توضیح**: آمار استفاده از کوپن
- **Auth**: ADMIN only
- **Response**: `{ usedCount, totalDiscount, revenueImpact }`

### Currency

#### GET /api/admin/currency/rates
- **توضیح**: لیست نرخ‌های ارز
- **Auth**: ADMIN only
- **Response**: `[{ base, target, rate, updatedAt }]`

#### POST /api/admin/currency/rates
- **توضیح**: ایجاد یا به‌روزرسانی نرخ ارز
- **Auth**: ADMIN only
- **Body**: `{ base, target, rate }`

#### GET /api/admin/currency/rates/history
- **توضیح**: تاریخچه تغییرات نرخ ارز
- **Auth**: ADMIN only

### Customers

#### GET /api/admin/customers
- **توضیح**: لیست مشتریان
- **Auth**: ADMIN only
- **Query**: `page`, `limit`, `segment`, `search`

#### GET /api/admin/customers/[id]
- **توضیح**: جزئیات مشتری
- **Auth**: ADMIN only

#### PUT /api/admin/customers/[id]/segment
- **توضیح**: تغییر سگمنت مشتری
- **Auth**: ADMIN only

### Experiments

#### GET /api/admin/experiments
- **توضیح**: لیست آزمایش‌های A/B
- **Auth**: ADMIN only

#### POST /api/admin/experiments
- **توضیح**: ایجاد آزمایش جدید
- **Auth**: ADMIN only
- **Body**: `{ key, name, description, variants: [{ key, name, weight, config }] }`

#### PUT /api/admin/experiments/[id]
- **توضیح**: ویرایش آزمایش
- **Auth**: ADMIN only

#### DELETE /api/admin/experiments/[id]
- **توضیح**: حذف آزمایش
- **Auth**: ADMIN only

#### POST /api/admin/experiments/[id]/apply-winner
- **توضیح**: اعمال واریانت برنده
- **Auth**: ADMIN only

#### GET /api/admin/experiments/[id]/stats
- **توضیح**: آمار آزمایش
- **Auth**: ADMIN only

### Header

#### GET /api/admin/header/nav
- **توضیح**: لیست آیتم‌های ناوبری
- **Auth**: ADMIN only

#### POST /api/admin/header/nav
- **توضیح**: ایجاد آیتم ناوبری
- **Auth**: ADMIN only

#### PUT /api/admin/header/nav/[id]
- **توضیح**: ویرایش آیتم ناوبری
- **Auth**: ADMIN only

#### DELETE /api/admin/header/nav/[id]
- **توضیح**: حذف آیتم ناوبری
- **Auth**: ADMIN only

#### POST /api/admin/header/nav/reorder
- **توضیح**: تغییر ترتیب آیتم‌ها
- **Auth**: ADMIN only

#### GET /api/admin/header/mega
- **توضیح**: لیست آیتم‌های مگامنو
- **Auth**: ADMIN only

#### POST /api/admin/header/mega
- **توضیح**: ایجاد آیتم مگامنو
- **Auth**: ADMIN only

#### PUT /api/admin/header/mega/[id]
- **توضیح**: ویرایش آیتم مگامنو
- **Auth**: ADMIN only

#### DELETE /api/admin/header/mega/[id]
- **توضیح**: حذف آیتم مگامنو
- **Auth**: ADMIN only

#### POST /api/admin/header/mega/reorder
- **توضیح**: تغییر ترتیب مگامنو
- **Auth**: ADMIN only

#### GET /api/admin/header/settings
- **توضیح**: تنظیمات هدر
- **Auth**: ADMIN only

#### PUT /api/admin/header/settings
- **توضیح**: به‌روزرسانی تنظیمات هدر
- **Auth**: ADMIN only

### Homepage

#### GET /api/admin/homepage
- **توضیح**: لیست بخش‌های صفحه اصلی
- **Auth**: ADMIN only

#### POST /api/admin/homepage
- **توضیح**: ایجاد بخش جدید
- **Auth**: ADMIN only
- **Body**: `{ type, title, config, sortOrder, isActive }`

#### PUT /api/admin/homepage/[id]
- **توضیح**: ویرایش بخش
- **Auth**: ADMIN only

#### DELETE /api/admin/homepage/[id]
- **توضیح**: حذف بخش
- **Auth**: ADMIN only

#### PUT /api/admin/homepage/[id]/toggle
- **توضیح**: فعال/غیرفعال کردن بخش
- **Auth**: ADMIN only

#### POST /api/admin/homepage/reorder
- **توضیح**: تغییر ترتیب بخش‌ها
- **Auth**: ADMIN only

#### GET /api/admin/homepage/pickers
- **توضیح**: داده‌های pickerها (محصولات، دسته‌بندی‌ها)
- **Auth**: ADMIN only

### Marketing

#### GET /api/admin/marketing/analytics
- **توضیح**: آمار مارکتینگ
- **Auth**: ADMIN only

#### GET /api/admin/marketing/segments
- **توضیح**: لیست سگمنت‌های مشتریان
- **Auth**: ADMIN only

#### GET /api/admin/marketing/campaigns
- **توضیح**: لیست کمپین‌ها
- **Auth**: ADMIN only

#### POST /api/admin/marketing/campaigns
- **توضیح**: ایجاد کمپین جدید
- **Auth**: ADMIN only

#### PUT /api/admin/marketing/campaigns/[id]
- **توضیح**: ویرایش کمپین
- **Auth**: ADMIN only

#### DELETE /api/admin/marketing/campaigns/[id]
- **توضیح**: حذف کمپین
- **Auth**: ADMIN only

#### POST /api/admin/marketing/campaigns/[id]/send
- **توضیح**: ارسال کمپین
- **Auth**: ADMIN only

#### GET /api/admin/marketing/settings
- **توضیح**: تنظیمات مارکتینگ (پیکسل‌ها)
- **Auth**: ADMIN only

#### PUT /api/admin/marketing/settings
- **توضیح**: به‌روزرسانی تنظیمات مارکتینگ
- **Auth**: ADMIN only

### Media

#### POST /api/admin/media/upload
- **توضیح**: آپلود فایل
- **Auth**: ADMIN only
- **Content-Type**: multipart/form-data
- **Response**: `{ id, url, filename, mimeType, size }`

#### GET /api/admin/media
- **توضیح**: لیست فایل‌ها
- **Auth**: ADMIN only
- **Query**: `page`, `limit`, `type`

#### DELETE /api/admin/media/[id]
- **توضیح**: حذف فایل
- **Auth**: ADMIN only

### Payments

#### GET /api/admin/payments
- **توضیح**: لیست پرداخت‌ها
- **Auth**: ADMIN only
- **Query**: `page`, `limit`, `status`

#### GET /api/admin/payments/[id]
- **توضیح**: جزئیات پرداخت
- **Auth**: ADMIN only

#### PUT /api/admin/payments/[id]/status
- **توضیح**: تغییر وضعیت پرداخت
- **Auth**: ADMIN only
- **Body**: `{ status }`

#### GET /api/admin/payments/settings
- **توضیح**: تنظیمات درگاه‌های پرداخت
- **Auth**: ADMIN only

#### PUT /api/admin/payments/settings
- **توضیح**: به‌روزرسانی تنظیمات پرداخت
- **Auth**: ADMIN only

### Products

#### GET /api/admin/products
- **توضیح**: لیست محصولات
- **Auth**: ADMIN only
- **Query**: `page`, `limit`, `category`, `search`, `isB2B`

#### POST /api/admin/products
- **توضیح**: ایجاد محصول جدید
- **Auth**: ADMIN only
- **Body**: `{ title, slug, description, price, categoryId, supplierId, brandId, stock, isB2B, images, ... }`

#### PUT /api/admin/products/[id]
- **توضیح**: ویرایش محصول
- **Auth**: ADMIN only

#### DELETE /api/admin/products/[id]
- **توضیح**: حذف محصول
- **Auth**: ADMIN only

#### GET /api/admin/products/[id]
- **توضیح**: جزئیات محصول
- **Auth**: ADMIN only

### Settings

#### GET /api/admin/settings
- **توضیح**: تنظیمات کلی سیستم
- **Auth**: ADMIN only

#### PUT /api/admin/settings
- **توضیح**: به‌روزرسانی تنظیمات
- **Auth**: ADMIN only

### Shipping

#### GET /api/admin/shipping/zones
- **توضیح**: لیست مناطق ارسال
- **Auth**: ADMIN only

#### POST /api/admin/shipping/zones
- **توضیح**: ایجاد منطقه جدید
- **Auth**: ADMIN only

#### PUT /api/admin/shipping/zones/[id]
- **توضیح**: ویرایش منطقه
- **Auth**: ADMIN only

#### DELETE /api/admin/shipping/zones/[id]
- **توضیح**: حذف منطقه
- **Auth**: ADMIN only

#### GET /api/admin/shipping/methods
- **توضیح**: لیست روش‌های ارسال
- **Auth**: ADMIN only

#### POST /api/admin/shipping/methods
- **توضیح**: ایجاد روش ارسال جدید
- **Auth**: ADMIN only

#### PUT /api/admin/shipping/methods/[id]
- **توضیح**: ویرایش روش ارسال
- **Auth**: ADMIN only

#### DELETE /api/admin/shipping/methods/[id]
- **توضیح**: حذف روش ارسال
- **Auth**: ADMIN only

#### GET /api/admin/shipping/settings
- **توضیح**: تنظیمات ارسال
- **Auth**: ADMIN only

#### PUT /api/admin/shipping/settings
- **توضیح**: به‌روزرسانی تنظیمات ارسال
- **Auth**: ADMIN only

### Suppliers

#### GET /api/admin/suppliers
- **توضیح**: لیست تأمین‌کنندگان
- **Auth**: ADMIN only

#### POST /api/admin/suppliers
- **توضیح**: ایجاد تأمین‌کننده جدید
- **Auth**: ADMIN only

#### PUT /api/admin/suppliers/[id]
- **توضیح**: ویرایش تأمین‌کننده
- **Auth**: ADMIN only

#### DELETE /api/admin/suppliers/[id]
- **توضیح**: حذف تأمین‌کننده
- **Auth**: ADMIN only

#### PUT /api/admin/suppliers/[id]/verify
- **توضیح**: تأیید تأمین‌کننده
- **Auth**: ADMIN only

### Affiliate

#### GET /api/admin/affiliate/commissions
- **توضیح**: لیست کمیسیون‌ها
- **Auth**: ADMIN only

#### PUT /api/admin/affiliate/commissions/[id]
- **توضیح**: به‌روزرسانی کمیسیون
- **Auth**: ADMIN only
- **Body**: `{ status, note }`

## Cart API

### GET /api/cart
- **توضیح**: دریافت سبد خرید کاربر
- **Auth**: Required
- **Response**: `{ id, items: [{ product, quantity, price }], coupon, total }`

### POST /api/cart/items
- **توضیح**: افزودن محصول به سبد
- **Auth**: Required
- **Body**: `{ productId, quantity }`

### PUT /api/cart/items/[productId]
- **توضیح**: به‌روزرسانی تعداد محصول
- **Auth**: Required
- **Body**: `{ quantity }`

### DELETE /api/cart/items/[productId]
- **توضیح**: حذف محصول از سبد
- **Auth**: Required

### POST /api/cart/coupon
- **توضیح**: اعمال کوپن
- **Auth**: Required
- **Body**: `{ code }`

### DELETE /api/cart/coupon
- **توضیح**: حذف کوپن
- **Auth**: Required

## Products API

### GET /api/products
- **توضیح**: لیست محصولات با فیلتر
- **Auth**: Optional (guest)
- **Query**: `page`, `limit`, `category`, `search`, `minPrice`, `maxPrice`, `isB2B`
- **Response**: `{ products: [], total, page, limit }`

### GET /api/products/[slug]
- **توضیح**: جزئیات محصول
- **Auth**: Optional (guest)
- **Response**: `{ product, relatedProducts }`

### GET /api/products/[slug]/reviews
- **توضیح**: نظرات محصول
- **Auth**: Optional (guest)

### POST /api/products/[slug]/reviews
- **توضیح**: ثبت نظر
- **Auth**: Required
- **Body**: `{ rating, comment }`

## Search API

### GET /api/search
- **توضیح**: جستجوی محصولات
- **Auth**: Optional (guest)
- **Query**: `q`, `page`, `limit`
- **Response**: `{ results: [], total, suggestions: [] }`

## Orders API

### GET /api/orders
- **توضیح**: لیست سفارشات کاربر
- **Auth**: Required
- **Response**: `{ orders: [] }`

### POST /api/orders
- **توضیح**: ایجاد سفارش جدید
- **Auth**: Required
- **Body**: `{ addressId, shippingMethodId, couponCode }`

### GET /api/orders/[id]
- **توضیح**: جزئیات سفارش
- **Auth**: Required (owner or admin)

## Auth API

### POST /api/auth/register
- **توضیح**: ثبت‌نام کاربر جدید
- **Auth**: None
- **Body**: `{ name, email, password }`

### POST /api/auth/login
- **توضیح**: ورود کاربر
- **Auth**: None
- **Body**: `{ email, password }`
- **Response**: `{ user, token }`

### POST /api/auth/logout
- **توضیح**: خروج کاربر
- **Auth**: Required

### POST /api/auth/forgot-password
- **توضیح**: درخواست بازیابی رمز عبور
- **Auth**: None
- **Body**: `{ email }`

### POST /api/auth/reset-password
- **توضیح**: تنظیم مجدد رمز عبور
- **Auth**: None
- **Body**: `{ token, password }`

## Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message",
    "details": { ... }
  }
}
```

## Common Error Codes

- `UNAUTHORIZED`: No valid token
- `FORBIDDEN`: Insufficient permissions
- `VALIDATION_ERROR`: Invalid input
- `NOT_FOUND`: Resource not found
- `CONFLICT`: Resource already exists
- `INTERNAL_ERROR`: Server error
