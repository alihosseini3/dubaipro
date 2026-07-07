# دیتابیس دبی‌پرو

## Overview
- **Database**: PostgreSQL
- **ORM**: Prisma 7.8.0
- **Adapter**: @prisma/adapter-pg
- **Connection Pool**: pg Pool

## Schema Structure

### Enums

#### UserRole
```prisma
enum UserRole {
  ADMIN
  CUSTOMER
  SELLER
  SUPPLIER
}
```

#### OrderStatus
```prisma
enum OrderStatus {
  PENDING
  PAID
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
}
```

#### PaymentStatus
```prisma
enum PaymentStatus {
  PENDING
  PROCESSING
  MANUAL_REVIEW
  PAID
  FAILED
  REFUNDED
  CANCELLED
}
```

#### CouponType
```prisma
enum CouponType {
  PERCENTAGE
  FIXED
}
```

#### CouponAppliesTo
```prisma
enum CouponAppliesTo {
  ALL
  CATEGORY
  PRODUCT
  USER
}
```

#### AutomationEventType
```prisma
enum AutomationEventType {
  USER_REGISTERED
  CART_ABANDONED
  ORDER_CREATED
  PAYMENT_SUCCESS
  FIRST_PURCHASE_UPSELL
  POST_PURCHASE_REMINDER
  INACTIVE_COMEBACK
  AFFILIATE_INVITE
  ORDER_FOLLOWUP
  DISCOUNT_OFFER
}
```

#### CampaignStatus
```prisma
enum CampaignStatus {
  DRAFT
  SCHEDULED
  SENDING
  COMPLETED
  CANCELLED
}
```

#### CampaignChannel
```prisma
enum CampaignChannel {
  EMAIL
  WHATSAPP
}
```

#### AutomationChannel
```prisma
enum AutomationChannel {
  EMAIL
  WHATSAPP
}
```

#### AutomationStatus
```prisma
enum AutomationStatus {
  SENT
  FAILED
  SKIPPED
}
```

#### CommissionStatus
```prisma
enum CommissionStatus {
  PENDING
  APPROVED
  PAID
  REJECTED
}
```

#### ExperimentEventType
```prisma
enum ExperimentEventType {
  IMPRESSION
  CLICK
  CONVERSION
}
```

#### CustomerSegment
```prisma
enum CustomerSegment {
  ALL
  NEW
  REPEAT
  HIGH_VALUE
  INACTIVE
}
```

#### ContactMessageStatus
```prisma
enum ContactMessageStatus {
  NEW
  READ
  ARCHIVED
}
```

## Core Models

### User
```prisma
model User {
  id           String      @id @default(cuid())
  name         String
  email        String      @unique
  password     String
  role         UserRole    @default(CUSTOMER)
  referralCode String?     @unique
  createdAt    DateTime    @default(now())
  
  supplier  Supplier?
  orders    Order[]
  cart      Cart?
  addresses Address[]
  wishlist  Wishlist?
  reviews   Review[]
  customerConversations Conversation[] @relation("CustomerConversations")
  sellerConversations   Conversation[] @relation("SellerConversations")
  messages              Message[]
  passwordResetTokens PasswordResetToken[]
  repliedContactMessages ContactMessage[]
  targetedCoupons     Coupon[]      @relation("UserCoupons")
  couponUsages        CouponUsage[]
  referralsMade       Referral[]    @relation("Referrer")
  referralReceived    Referral?     @relation("Referred")
  commissionsEarned   Commission[]
  metrics             UserMetrics?
  auctionBids         AuctionBid[]
  uploadedMedia       MediaAsset[]
  consentAt           DateTime?

  @@index([role])
  @@index([createdAt])
}
```

### PasswordResetToken
```prisma
model PasswordResetToken {
  id        String   @id @default(cuid())
  userId    String
  tokenHash String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}
```

### Cart
```prisma
model Cart {
  id        String     @id @default(cuid())
  userId    String     @unique
  couponId  String?
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  items     CartItem[]
  coupon    Coupon?    @relation(fields: [couponId], references: [id], onDelete: SetNull)

  @@index([couponId])
}
```

### CartItem
```prisma
model CartItem {
  id        String   @id @default(cuid())
  cartId    String
  productId String
  quantity  Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  cart      Cart     @relation(fields: [cartId], references: [id], onDelete: Cascade)
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([cartId, productId])
  @@index([cartId])
  @@index([productId])
}
```

### Supplier
```prisma
model Supplier {
  id        String    @id @default(cuid())
  userId    String    @unique
  name      String
  country   String
  phone     String?
  verified  Boolean   @default(false)
  createdAt DateTime  @default(now())

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  products  Product[]
  auctions  Auction[]

  @@index([country])
  @@index([verified])
}
```

### Category
```prisma
model Category {
  id          String    @id @default(cuid())
  name        String
  slug        String    @unique
  parentId    String?
  icon        String?   @db.VarChar(64)
  imageUrl    String?
  description String?   @db.VarChar(500)
  metaTitle       String? @db.VarChar(70)
  metaDescription String? @db.VarChar(200)
  sortOrder   Int       @default(0)
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())

  parent      Category?  @relation("CategoryChildren", fields: [parentId], references: [id], onDelete: SetNull)
  children    Category[] @relation("CategoryChildren")

  products         Product[]
  coupons          Coupon[]
  megaMenuItems    MegaMenuItem[]
  categoryAttributes CategoryAttribute[]
  filterConfig     CategoryFilterConfig?

  @@index([name])
  @@index([parentId])
  @@index([sortOrder])
  @@index([isActive])
}
```

### Brand
```prisma
model Brand {
  id        String    @id @default(cuid())
  name      String
  slug      String    @unique
  createdAt DateTime  @default(now())

  products  Product[]

  @@index([name])
}
```

### Product
```prisma
model Product {
  id          String      @id @default(cuid())
  supplierId  String
  categoryId  String
  brandId     String?
  title       String
  slug        String      @unique
  description String      @db.Text
  price           Decimal  @db.Decimal(12, 2)
  compareAtPrice  Decimal? @db.Decimal(12, 2)
  currency    String      @default("USD") @db.VarChar(3)
  stock       Int         @default(0)
  isB2B       Boolean     @default(false)
  imageUrl    String?
  images      Json?
  weight        Float?
  length        Float?
  width         Float?
  height        Float?
  shippingClass String?   @default("normal") @db.VarChar(32)
  metaTitle       String?  @db.VarChar(70)
  metaDescription String?  @db.VarChar(200)
  createdAt   DateTime    @default(now())

  supplier    Supplier    @relation(fields: [supplierId], references: [id], onDelete: Restrict)
  category    Category    @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  brand       Brand?      @relation(fields: [brandId], references: [id], onDelete: SetNull)
  orderItems  OrderItem[]
  cartItems   CartItem[]
  wishlistItems WishlistItem[]
  reviews     Review[]
  coupons     Coupon[]
  attributeValues ProductAttributeValue[]

  @@index([supplierId])
  @@index([categoryId])
  @@index([brandId])
  @@index([slug])
  @@index([isB2B])
  @@index([createdAt])
  @@index([price])
  @@index([title])
}
```

### Order
```prisma
model Order {
  id         String       @id @default(cuid())
  userId      String
  totalPrice  Decimal      @db.Decimal(12, 2)
  shippingPrice    Decimal      @default(0) @db.Decimal(12, 2)
  shippingBreakdown Json?
  discountAmount   Decimal      @default(0) @db.Decimal(12, 2)
  couponId         String?
  couponCode       String?
  addressId        String?
  shippingMethodId String?
  status      OrderStatus  @default(PENDING)
  paymentStatus PaymentStatus? @default(PENDING)
  paymentMethod String?     @db.VarChar(32)
  paidAt        DateTime?
  trackingCode String?     @db.VarChar(64)
  carrier      String?     @db.VarChar(64)
  whatsappClickId String?  @db.VarChar(64)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  user           User            @relation(fields: [userId], references: [id], onDelete: Restrict)
  address        Address?        @relation(fields: [addressId], references: [id], onDelete: SetNull)
  shippingMethod ShippingMethod? @relation(fields: [shippingMethodId], references: [id], onDelete: SetNull)
  coupon         Coupon?         @relation(fields: [couponId], references: [id], onDelete: SetNull)
  items          OrderItem[]
  payments       Payment[]
  couponUsage    CouponUsage?
  commission     Commission?

  @@index([userId])
  @@index([status])
  @@index([whatsappClickId])
  @@index([createdAt])
  @@index([updatedAt])
  @@index([addressId])
  @@index([shippingMethodId])
  @@index([couponId])
}
```

### Address
```prisma
model Address {
  id          String   @id @default(cuid())
  userId      String
  fullName    String
  phone       String
  country     String
  city        String
  addressLine String   @db.Text
  postalCode  String
  isDefault   Boolean  @default(false)
  createdAt   DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  orders      Order[]

  @@index([userId])
  @@index([userId, isDefault])
}
```

### Coupon
```prisma
model Coupon {
  id             String          @id @default(cuid())
  code           String          @unique
  description    String?         @db.Text
  type           CouponType
  value          Decimal         @db.Decimal(12, 2)
  minOrderAmount Decimal?        @db.Decimal(12, 2)
  maxDiscount    Decimal?        @db.Decimal(12, 2)
  usageLimit     Int?
  usedCount      Int             @default(0)
  expiresAt      DateTime?
  isActive       Boolean         @default(true)

  appliesTo      CouponAppliesTo @default(ALL)
  categoryId     String?
  productId      String?
  userId         String?
  firstOrderOnly Boolean         @default(false)
  perUserLimit   Int?
  startAt        DateTime?
  autoApply      Boolean         @default(false)

  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  category Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  product  Product?  @relation(fields: [productId], references: [id], onDelete: SetNull)
  user     User?     @relation("UserCoupons", fields: [userId], references: [id], onDelete: SetNull)

  carts   Cart[]
  orders  Order[]
  usages  CouponUsage[]

  @@index([code])
  @@index([isActive])
  @@index([expiresAt])
  @@index([startAt])
  @@index([autoApply, isActive])
  @@index([categoryId])
  @@index([productId])
  @@index([userId])
}
```

### CouponUsage
```prisma
model CouponUsage {
  id        String   @id @default(cuid())
  couponId  String
  userId    String
  orderId   String   @unique
  usedAt    DateTime @default(now())

  coupon Coupon @relation(fields: [couponId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  order  Order  @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([couponId])
  @@index([userId])
  @@index([couponId, userId])
}
```

### ShippingZone
```prisma
model ShippingZone {
  id        String   @id @default(cuid())
  name      String   @db.VarChar(80)
  countries String[] @db.VarChar(8)
  isActive  Boolean  @default(true)
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  methods   ShippingMethod[]

  @@index([isActive])
  @@index([sortOrder])
}
```

### ShippingMethod
```prisma
model ShippingMethod {
  id            String   @id @default(cuid())
  name          String
  description   String?  @db.Text
  price         Decimal  @db.Decimal(12, 2)
  estimatedDays Int
  isActive      Boolean  @default(true)
  sortOrder     Int      @default(0)
  zoneId        String?
  minWeight        Float?
  maxWeight        Float?
  basePrice        Decimal? @db.Decimal(12, 2)
  pricePerKg       Decimal? @db.Decimal(12, 2)
  volumetricFactor Float?
  shippingClass    String?  @db.VarChar(32)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  orders        Order[]
  zone          ShippingZone? @relation(fields: [zoneId], references: [id], onDelete: SetNull)

  @@index([isActive])
  @@index([sortOrder])
  @@index([zoneId])
}
```

### ShippingSettings
```prisma
model ShippingSettings {
  id                       String   @id @default("default")
  defaultVolumetricFactor  Float    @default(5000)
  enableVolumetric         Boolean  @default(false)
  roundingStrategy         String   @default("ceil") @db.VarChar(16)
  updatedAt                DateTime @updatedAt
}
```

### PaymentSettings
```prisma
model PaymentSettings {
  id                  String   @id @default("default")

  enableMellat        Boolean  @default(false)
  enableZarinpal      Boolean  @default(false)
  enableCardTransfer  Boolean  @default(false)
  enableBankTransfer  Boolean  @default(false)
  enableStripe        Boolean  @default(false)
  enableTap           Boolean  @default(false)
  enablePaypal        Boolean  @default(false)

  mellatTerminalId    String?  @db.VarChar(64)
  mellatUsername      String?  @db.VarChar(128)
  mellatPassword      String?  @db.VarChar(256)
  zarinpalMerchantId  String?  @db.VarChar(128)

  stripePublicKey     String?  @db.VarChar(256)
  stripeSecretKey     String?  @db.VarChar(256)
  stripeWebhookSecret String?  @db.VarChar(256)
  tapSecretKey        String?  @db.VarChar(256)
  paypalClientId      String?  @db.VarChar(256)
  paypalClientSecret String?  @db.VarChar(256)

  cardNumber          String?  @db.VarChar(64)
  iban                String?  @db.VarChar(64)
  accountHolder       String?  @db.VarChar(128)
  bankName            String?  @db.VarChar(128)
  manualNotes         String?  @db.VarChar(512)

  updatedAt           DateTime @updatedAt
}
```

### Payment
```prisma
model Payment {
  id              String         @id @default(cuid())
  orderId         String
  amount          Decimal        @db.Decimal(12, 2)
  currency        String         @db.VarChar(3)
  status          PaymentStatus  @default(PENDING)
  provider        String         @db.VarChar(32)
  method          String?        @db.VarChar(32)
  providerId      String?        @unique
  referenceNumber String?        @db.VarChar(128)
  receiptImage    String?
  metadata        Json?
  errorMessage    String?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  order           Order          @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId])
  @@index([status])
  @@index([provider])
  @@index([method])
}
```

### OrderItem
```prisma
model OrderItem {
  id         String    @id @default(cuid())
  orderId     String
  productId   String
  quantity    Int
  price       Decimal   @db.Decimal(12, 2)

  order       Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product     Product   @relation(fields: [productId], references: [id], onDelete: Restrict)

  @@index([orderId])
  @@index([productId])
  @@unique([orderId, productId])
}
```

### CurrencyRate
```prisma
model CurrencyRate {
  id        String   @id @default(cuid())
  base      String   @default("AED")
  target    String
  rate      Decimal  @db.Decimal(18, 8)
  updatedAt DateTime @updatedAt

  history   CurrencyRateHistory[]

  @@unique([base, target])
  @@index([target])
}
```

### CurrencyRateHistory
```prisma
model CurrencyRateHistory {
  id         String   @id @default(cuid())
  rateId     String
  base       String
  target     String
  rate       Decimal  @db.Decimal(18, 8)
  source     String   @default("manual")
  changedBy  String?
  createdAt  DateTime @default(now())

  currencyRate CurrencyRate @relation(fields: [rateId], references: [id], onDelete: Cascade)

  @@index([rateId])
  @@index([base, target, createdAt])
}
```

### Wishlist
```prisma
model Wishlist {
  id        String   @id @default(cuid())
  userId    String   @unique
  createdAt DateTime @default(now())

  user  User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  items WishlistItem[]
}
```

### WishlistItem
```prisma
model WishlistItem {
  id         String   @id @default(cuid())
  wishlistId String
  productId  String
  createdAt  DateTime @default(now())

  wishlist Wishlist @relation(fields: [wishlistId], references: [id], onDelete: Cascade)
  product  Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([wishlistId, productId])
  @@index([productId])
  @@index([wishlistId, createdAt])
}
```

### Conversation
```prisma
model Conversation {
  id         String   @id @default(cuid())
  customerId String
  sellerId   String
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  customer       User             @relation("CustomerConversations", fields: [customerId], references: [id], onDelete: Cascade)
  seller         User             @relation("SellerConversations",   fields: [sellerId],   references: [id], onDelete: Cascade)
  messages       Message[]
  contactMessage ContactMessage[]

  @@unique([customerId, sellerId])
  @@index([customerId, updatedAt])
  @@index([sellerId, updatedAt])
}
```

### Message
```prisma
model Message {
  id             String   @id @default(cuid())
  conversationId String
  senderId       String
  content        String   @db.Text
  createdAt      DateTime @default(now())

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender       User         @relation(fields: [senderId], references: [id], onDelete: Cascade)

  @@index([conversationId, createdAt])
  @@index([senderId])
}
```

### WhatsAppClick
```prisma
model WhatsAppClick {
  id          String    @id @default(cuid())
  productId   String?
  supplierId  String?
  source      String    @default("unknown")
  utmSource   String?
  utmMedium   String?
  utmCampaign String?
  createdAt   DateTime  @default(now())
  expiresAt   DateTime?

  @@index([createdAt])
  @@index([productId])
  @@index([supplierId])
  @@index([utmCampaign])
  @@index([utmSource])
  @@index([expiresAt])
}
```

### WhatsAppSettings
```prisma
model WhatsAppSettings {
  id                 String   @id @default("singleton")
  phone              String   @default("")
  defaultMessage     String   @default("") @db.Text
  isEnabled          Boolean  @default(false)
  showFloating       Boolean  @default(true)
  showOnProduct      Boolean  @default(true)
  enableInternalChat Boolean  @default(true)
  enableContactForm  Boolean  @default(true)
  updatedAt          DateTime @updatedAt
}
```

### ContactMessage
```prisma
model ContactMessage {
  id             String               @id @default(cuid())
  name           String
  email          String
  subject        String?
  message        String               @db.Text
  userId         String?
  locale         String?
  userAgent      String?              @db.Text
  status         ContactMessageStatus @default(NEW)
  createdAt      DateTime             @default(now())
  
  replyContent   String?              @db.Text
  replySentAt    DateTime?
  repliedById    String?
  conversationId String?
  
  conversation   Conversation?        @relation(fields: [conversationId], references: [id])
  repliedBy      User?                @relation(fields: [repliedById], references: [id])

  @@index([createdAt])
  @@index([status])
  @@index([email])
  @@index([conversationId])
}
```

### Review
```prisma
model Review {
  id        String   @id @default(cuid())
  userId    String
  productId String
  rating    Int
  comment   String   @db.Text
  createdAt DateTime @default(now())

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([userId, productId])
  @@index([productId, createdAt])
  @@index([userId])
  @@index([rating])
}
```

### AutomationRule
```prisma
model AutomationRule {
  id        String              @id @default(cuid())
  eventType AutomationEventType
  channel   AutomationChannel
  locale    String              @db.VarChar(8)
  segment   CustomerSegment     @default(ALL)
  enabled   Boolean             @default(true)
  subject   String?
  body      String              @db.Text
  createdAt DateTime            @default(now())
  updatedAt DateTime            @updatedAt

  @@unique([eventType, channel, locale, segment])
  @@index([eventType])
}
```

### AutomationLog
```prisma
model AutomationLog {
  id        String              @id @default(cuid())
  userId    String?
  eventType AutomationEventType
  channel   AutomationChannel
  status    AutomationStatus
  recipient String?             @db.VarChar(255)
  dedupeKey String?             @db.VarChar(255)
  error     String?             @db.Text
  payload   Json?
  createdAt DateTime            @default(now())

  @@unique([dedupeKey, channel, eventType])
  @@index([userId, createdAt])
  @@index([eventType, createdAt])
}
```

### Referral
```prisma
model Referral {
  id             String   @id @default(cuid())
  referrerUserId String
  referredUserId String   @unique
  code           String
  createdAt      DateTime @default(now())

  referrer User @relation("Referrer", fields: [referrerUserId], references: [id], onDelete: Cascade)
  referred User @relation("Referred", fields: [referredUserId], references: [id], onDelete: Cascade)

  @@index([referrerUserId, createdAt])
  @@index([code])
}
```

### Commission
```prisma
model Commission {
  id             String           @id @default(cuid())
  referrerUserId String
  orderId        String           @unique
  amount         Decimal          @db.Decimal(12, 2)
  currency       String           @db.VarChar(3)
  status         CommissionStatus @default(PENDING)
  createdAt      DateTime         @default(now())
  approvedAt     DateTime?
  paidAt         DateTime?
  note           String?          @db.Text

  referrer User  @relation(fields: [referrerUserId], references: [id], onDelete: Cascade)
  order    Order @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([referrerUserId, status])
  @@index([status, createdAt])
}
```

### MarketingSettings
```prisma
model MarketingSettings {
  id              String   @id @default("default")
  trackingEnabled Boolean  @default(false)
  googleAdsId     String?
  googleConvLabel String?
  metaPixelId     String?
  metaAccessToken String?  @db.Text
  metaTestEventCode String? @db.VarChar(32)
  ga4MeasurementId String? @db.VarChar(32)
  ga4ApiSecret    String?  @db.Text
  requireConsent  Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### Experiment
```prisma
model Experiment {
  id          String   @id @default(cuid())
  key         String   @unique @db.VarChar(64)
  name        String
  description String?  @db.Text
  isActive    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  variants ExperimentVariant[]
  events   ExperimentEvent[]

  @@index([isActive])
}
```

### ExperimentVariant
```prisma
model ExperimentVariant {
  id           String   @id @default(cuid())
  experimentId String
  key          String   @db.VarChar(32)
  name         String
  weight       Int      @default(1)
  config       Json     @default("{}")
  createdAt    DateTime @default(now())

  experiment Experiment        @relation(fields: [experimentId], references: [id], onDelete: Cascade)
  events     ExperimentEvent[]

  @@unique([experimentId, key])
}
```

### ExperimentEvent
```prisma
model ExperimentEvent {
  id           String              @id @default(cuid())
  experimentId String
  variantId    String
  type         ExperimentEventType
  visitorId    String              @db.VarChar(64)
  userId       String?
  value        Decimal             @default(0) @db.Decimal(12, 2)
  createdAt    DateTime            @default(now())

  experiment Experiment        @relation(fields: [experimentId], references: [id], onDelete: Cascade)
  variant    ExperimentVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)

  @@index([experimentId, type, createdAt])
  @@index([variantId, type])
  @@index([visitorId])
}
```

### UserMetrics
```prisma
model UserMetrics {
  userId         String           @id
  totalSpent     Decimal          @default(0) @db.Decimal(14, 2)
  lifetimeValue  Decimal          @default(0) @db.Decimal(14, 2)
  orderCount     Int              @default(0)
  firstOrderAt   DateTime?
  lastOrderAt    DateTime?
  segment        CustomerSegment  @default(NEW)
  reminder7At    DateTime?
  comeback30At   DateTime?
}
```

## Indexes Strategy

### Critical Indexes
- **User**: role, createdAt
- **Product**: supplierId, categoryId, brandId, slug, isB2B, price, title
- **Order**: userId, status, createdAt, updatedAt
- **Coupon**: code, isActive, expiresAt, startAt
- **Payment**: orderId, status, provider
- **CurrencyRate**: target, (base, target) unique
- **AutomationLog**: userId, createdAt, eventType, createdAt
- **ExperimentEvent**: experimentId, type, createdAt
- **Commission**: referrerUserId, status, status, createdAt

## Migration History

Migrations در `prisma/migrations/` ذخیره می‌شوند.

### Commands
```bash
npm run db:generate    # Generate Prisma Client
npm run db:migrate      # Create and apply migration
npm run db:deploy      # Apply migrations in production
npm run db:studio      # Open Prisma Studio
npm run db:seed        # Seed database
```

## Connection Pooling

```typescript
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});
```

## Data Seeding

Seed script در `prisma/seed.mjs` برای داده‌های اولیه.
