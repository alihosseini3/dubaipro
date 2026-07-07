import type {
  AutomationChannel,
  AutomationEventType,
  CustomerSegment
} from '@prisma/client';

/**
 * Built-in defaults. Used when no DB row exists for the (event,
 * channel, locale, segment) tuple — admins can override any of these
 * via /admin/automation which writes to AutomationRule.
 *
 * Variables: {name} {product} {price} {link} {lastProduct}
 *            {recommendedProducts} {discountCode}
 *
 * Keys without a segment suffix implicitly mean `:ALL`. Segment-
 * specific keys (e.g. `INACTIVE_COMEBACK:EMAIL:en:INACTIVE`) override
 * the ALL fallback inside `getDefaultTemplate`.
 */

export type TemplateSeed = {
  subject?: string;
  body: string;
};

type Key = string;

const T: Record<Key, TemplateSeed> = {
  // ---- USER_REGISTERED ----------------------------------------------
  'USER_REGISTERED:EMAIL:en': {
    subject: 'Welcome to Dubai Pro, {name}!',
    body: `<p>Hi {name},</p>
<p>Thanks for joining Dubai Pro. Browse verified suppliers and request custom quotes anytime.</p>
<p><a href="{link}">Start exploring</a></p>`
  },
  'USER_REGISTERED:EMAIL:fa': {
    subject: 'به دبی پرو خوش آمدید، {name}!',
    body: `<p>سلام {name}،</p>
<p>از پیوستن شما به دبی پرو سپاسگزاریم. هر زمان می‌توانید تامین‌کنندگان معتبر را مرور کرده و درخواست قیمت اختصاصی ثبت کنید.</p>
<p><a href="{link}">شروع کاوش</a></p>`
  },
  'USER_REGISTERED:EMAIL:ar': {
    subject: 'مرحبًا بك في دبي برو، {name}!',
    body: `<p>مرحبًا {name}،</p>
<p>شكرًا لانضمامك إلى دبي برو. تصفح موردين موثوقين واطلب عروض أسعار مخصصة في أي وقت.</p>
<p><a href="{link}">ابدأ الاستكشاف</a></p>`
  },
  'USER_REGISTERED:WHATSAPP:en': {
    body: 'Hi {name}, welcome to Dubai Pro! Start sourcing here: {link}'
  },
  'USER_REGISTERED:WHATSAPP:fa': {
    body: 'سلام {name}، به دبی پرو خوش آمدید! تامین از اینجا شروع می‌شود: {link}'
  },

  // ---- ORDER_CREATED -----------------------------------------------
  'ORDER_CREATED:EMAIL:en': {
    subject: 'Order received — thanks, {name}',
    body: `<p>Hi {name},</p>
<p>We received your order. Total: {price}. We'll notify you once payment is confirmed.</p>
<p><a href="{link}">View order</a></p>`
  },
  'ORDER_CREATED:EMAIL:fa': {
    subject: 'سفارش شما دریافت شد — متشکریم {name}',
    body: `<p>سلام {name}،</p>
<p>سفارش شما دریافت شد. مجموع: {price}. پس از تایید پرداخت اطلاع‌رسانی می‌شود.</p>
<p><a href="{link}">مشاهده سفارش</a></p>`
  },
  'ORDER_CREATED:EMAIL:ar': {
    subject: 'تم استلام طلبك — شكرًا {name}',
    body: `<p>مرحبًا {name}،</p>
<p>تم استلام طلبك. الإجمالي: {price}. سنُعلمك بمجرد تأكيد الدفع.</p>
<p><a href="{link}">عرض الطلب</a></p>`
  },
  'ORDER_CREATED:WHATSAPP:en': {
    body: 'Hi {name}, order received! Total {price}. Track: {link}'
  },

  // ---- PAYMENT_SUCCESS ---------------------------------------------
  'PAYMENT_SUCCESS:EMAIL:en': {
    subject: 'Payment confirmed — order on the way, {name}',
    body: `<p>Hi {name},</p>
<p>Payment of {price} received. Your order is now being prepared.</p>
<p><a href="{link}">View order</a></p>`
  },
  'PAYMENT_SUCCESS:EMAIL:fa': {
    subject: 'پرداخت تایید شد — سفارش در راه است، {name}',
    body: `<p>سلام {name}،</p>
<p>پرداخت {price} دریافت شد. سفارش شما در حال آماده‌سازی است.</p>
<p><a href="{link}">مشاهده سفارش</a></p>`
  },
  'PAYMENT_SUCCESS:WHATSAPP:en': {
    body: 'Payment confirmed ({price}). Order is being prepared. {link}'
  },

  // ---- CART_ABANDONED ----------------------------------------------
  'CART_ABANDONED:EMAIL:en': {
    subject: 'You left {product} in your cart',
    body: `<p>Hi {name},</p>
<p>You left <strong>{product}</strong> ({price}) in your cart. Complete checkout in one tap.</p>
<p><a href="{link}">Resume checkout</a></p>`
  },
  'CART_ABANDONED:EMAIL:fa': {
    subject: 'شما {product} را در سبد خرید رها کرده‌اید',
    body: `<p>سلام {name}،</p>
<p>شما <strong>{product}</strong> ({price}) را در سبد خرید گذاشته‌اید. تسویه را با یک کلیک کامل کنید.</p>
<p><a href="{link}">ادامه پرداخت</a></p>`
  },
  'CART_ABANDONED:WHATSAPP:en': {
    body: 'Hi {name}, you left {product} ({price}) in your cart. Finish here: {link}'
  },
  'CART_ABANDONED:WHATSAPP:fa': {
    body: 'سلام {name}، {product} ({price}) در سبد شما باقی مانده. تکمیل از اینجا: {link}'
  },

  // ---- FIRST_PURCHASE_UPSELL --------------------------------------
  'FIRST_PURCHASE_UPSELL:EMAIL:en': {
    subject: 'Thanks for your first order, {name} — picked these for you',
    body: `<p>Hi {name},</p>
<p>Thanks for your first order with us! Customers like you often add these next:</p>
<p><a href="{link}">See recommendations</a></p>`
  },
  'FIRST_PURCHASE_UPSELL:EMAIL:fa': {
    subject: 'ممنون از اولین خرید شما {name} — این‌ها را برای شما انتخاب کردیم',
    body: `<p>سلام {name}،</p>
<p>از اولین خرید شما متشکریم! مشتریانی مثل شما معمولاً این‌ها را هم می‌خرند:</p>
<p><a href="{link}">مشاهده پیشنهادها</a></p>`
  },
  'FIRST_PURCHASE_UPSELL:EMAIL:ar': {
    subject: 'شكرًا على طلبك الأول {name} — اخترنا لك هذه',
    body: `<p>مرحبًا {name},</p>
<p>شكرًا على طلبك الأول! غالبًا ما يضيف العملاء مثلك هذه المنتجات تاليًا:</p>
<p><a href="{link}">شاهد التوصيات</a></p>`
  },
  'FIRST_PURCHASE_UPSELL:WHATSAPP:en': {
    body: 'Hi {name}, thanks for your first order! Picks for you: {link}'
  },

  // ---- POST_PURCHASE_REMINDER (D+7) -------------------------------
  'POST_PURCHASE_REMINDER:EMAIL:en': {
    subject: 'How is everything, {name}?',
    body: `<p>Hi {name},</p>
<p>It has been a week since your last order. Need a refill or have feedback? We are listening.</p>
<p><a href="{link}">Reorder or review</a></p>`
  },
  'POST_PURCHASE_REMINDER:EMAIL:fa': {
    subject: 'همه‌چیز خوب پیش می‌رود {name}؟',
    body: `<p>سلام {name}،</p>
<p>یک هفته از آخرین سفارش شما گذشته. اگر نیاز به سفارش مجدد یا ثبت نظر دارید، ما در خدمتیم.</p>
<p><a href="{link}">سفارش مجدد یا ثبت نظر</a></p>`
  },
  'POST_PURCHASE_REMINDER:WHATSAPP:en': {
    body: 'Hi {name}, hope your last order arrived well! Reorder or review: {link}'
  },

  // ---- INACTIVE_COMEBACK (D+30 dormant) ---------------------------
  'INACTIVE_COMEBACK:EMAIL:en': {
    subject: 'We miss you, {name} — a treat to come back',
    body: `<p>Hi {name},</p>
<p>It has been a while. Here is what is new and a small thank-you for returning.</p>
<p><a href="{link}">See what is new</a></p>`
  },
  'INACTIVE_COMEBACK:EMAIL:fa': {
    subject: 'دلتنگ شما هستیم {name} — هدیه‌ای برای بازگشت',
    body: `<p>سلام {name}،</p>
<p>مدتی است شما را ندیده‌ایم. این هم تازه‌ترین‌ها و یک تشکر کوچک برای بازگشت شما.</p>
<p><a href="{link}">تازه‌ها را ببینید</a></p>`
  },
  'INACTIVE_COMEBACK:WHATSAPP:en': {
    body: 'Hi {name}, we miss you! Here is what is new: {link}'
  },

  // ---- Segment-specific overrides --------------------------------------
  // Naming convention: `EVENT:CHANNEL:locale:SEGMENT`.
  // Only listed where the segment voice differs meaningfully from ALL.

  // FIRST_PURCHASE_UPSELL → REPEAT shouldn't fire (handled by event
  // logic) but we ship a HIGH_VALUE variant for whales who happen to
  // land here on edge cases.
  'FIRST_PURCHASE_UPSELL:EMAIL:en:HIGH_VALUE': {
    subject: 'Welcome to the inner circle, {name}',
    body: `<p>Hi {name},</p>
<p>Thanks for your first order — and for joining our top tier of customers. Your dedicated account manager will reach out shortly with VIP pricing on:</p>
<p>{recommendedProducts}</p>
<p><a href="{link}">Explore VIP catalogue</a></p>`
  },

  // POST_PURCHASE_REMINDER → REPEAT gets a bundle/upsell tone.
  'POST_PURCHASE_REMINDER:EMAIL:en:REPEAT': {
    subject: 'Bundle and save on your next order, {name}',
    body: `<p>Hi {name},</p>
<p>Customers who bought {lastProduct} often pair it with these — bundle them and save 10% with code <strong>{discountCode}</strong>:</p>
<p>{recommendedProducts}</p>
<p><a href="{link}">Build your bundle</a></p>`
  },

  // POST_PURCHASE_REMINDER → HIGH_VALUE: VIP tone, no discount needed.
  'POST_PURCHASE_REMINDER:EMAIL:en:HIGH_VALUE': {
    subject: 'A VIP pick for you, {name}',
    body: `<p>Hi {name},</p>
<p>Based on {lastProduct}, our concierge team curated a private selection for you. No code needed — VIP pricing is already applied.</p>
<p>{recommendedProducts}</p>
<p><a href="{link}">View private selection</a></p>`
  },

  // INACTIVE_COMEBACK gets the discount headline.
  'INACTIVE_COMEBACK:EMAIL:en:INACTIVE': {
    subject: 'It has been a while, {name} — {discountCode} is your welcome-back code',
    body: `<p>Hi {name},</p>
<p>We miss you. Use code <strong>{discountCode}</strong> for a discount on your next order — no minimum.</p>
<p>You might like these picks based on your last order ({lastProduct}):</p>
<p>{recommendedProducts}</p>
<p><a href="{link}">Shop with my code</a></p>`
  },
  'INACTIVE_COMEBACK:WHATSAPP:en:INACTIVE': {
    body: 'Hi {name}, miss you! Code {discountCode} works on your next order: {link}'
  },

  // USER_REGISTERED → NEW gets onboarding tips beyond the welcome.
  'USER_REGISTERED:EMAIL:en:NEW': {
    subject: 'Welcome {name} — 3 tips to get started',
    body: `<p>Hi {name},</p>
<p>Welcome to Dubai Pro. Here are three things our happiest new customers do first:</p>
<ol>
<li>Verify your account so suppliers can quote you faster.</li>
<li>Save items to a wishlist — we will notify you when prices drop.</li>
<li>Browse our catalogue and request a custom quote from any supplier.</li>
</ol>
<p><a href="{link}">Open your dashboard</a></p>`
  },

  // ---- AFFILIATE_INVITE -------------------------------------------
  'AFFILIATE_INVITE:EMAIL:en': {
    subject: 'Earn rewards — join the Dubai Pro affiliate programme',
    body: `<p>Hi {name},</p>
<p>We'd love to have you as a Dubai Pro affiliate. Share your referral link and earn a commission on every order from users you refer.</p>
<p><a href="{link}">Join the programme</a></p>`
  },
  'AFFILIATE_INVITE:EMAIL:fa': {
    subject: 'درآمد بیشتر — به برنامه همکاری دبی پرو بپیوندید',
    body: `<p>سلام {name}،</p>
<p>می‌خواهیم شما را به عنوان همکار فروش دبی پرو داشته باشیم. لینک معرف خود را به اشتراک بگذارید و از هر سفارش کاربران معرفی‌شده کمیسیون بگیرید.</p>
<p><a href="{link}">ورود به برنامه</a></p>`
  },
  'AFFILIATE_INVITE:EMAIL:ar': {
    subject: 'اكسب مكافآت — انضم إلى برنامج الإحالة في دبي برو',
    body: `<p>مرحبًا {name}،</p>
<p>نود أن تكون شريكًا في دبي برو. شارك رابط الإحالة الخاص بك واكسب عمولة على كل طلب من المستخدمين الذين تُحيلهم.</p>
<p><a href="{link}">انضم إلى البرنامج</a></p>`
  },
  'AFFILIATE_INVITE:WHATSAPP:en': {
    body: 'Hi {name}! Join the Dubai Pro affiliate programme and earn on every referral: {link}'
  },

  // ---- ORDER_FOLLOWUP ----------------------------------------------
  'ORDER_FOLLOWUP:EMAIL:en': {
    subject: 'How was your order, {name}?',
    body: `<p>Hi {name},</p>
<p>We hope you are happy with your recent order. Would you take a moment to leave a review?</p>
<p><a href="{link}">Leave a review</a></p>`
  },
  'ORDER_FOLLOWUP:EMAIL:fa': {
    subject: 'سفارش شما چطور بود، {name}؟',
    body: `<p>سلام {name}،</p>
<p>امیدواریم از سفارش اخیر خود راضی باشید. آیا می‌توانید یک نظر بنویسید؟</p>
<p><a href="{link}">ثبت نظر</a></p>`
  },
  'ORDER_FOLLOWUP:EMAIL:ar': {
    subject: 'كيف كان طلبك، {name}؟',
    body: `<p>مرحبًا {name}،</p>
<p>نأمل أن تكون راضيًا عن طلبك الأخير. هل يمكنك كتابة تقييم؟</p>
<p><a href="{link}">اترك تقييمًا</a></p>`
  },
  'ORDER_FOLLOWUP:WHATSAPP:en': {
    body: 'Hi {name}, how was your recent order? Leave a review here: {link}'
  },

  // ---- DISCOUNT_OFFER ----------------------------------------------
  'DISCOUNT_OFFER:EMAIL:en': {
    subject: 'Exclusive offer for you, {name} 🎁',
    body: `<p>Hi {name},</p>
<p>Here is an exclusive discount just for you. Use code <strong>{discountCode}</strong> to save on your next order.</p>
<p><a href="{link}">Shop now</a></p>`
  },
  'DISCOUNT_OFFER:EMAIL:fa': {
    subject: 'پیشنهاد ویژه برای شما، {name}',
    body: `<p>سلام {name}،</p>
<p>یک تخفیف اختصاصی برای شما داریم. از کد <strong>{discountCode}</strong> در سفارش بعدی استفاده کنید.</p>
<p><a href="{link}">خرید کنید</a></p>`
  },
  'DISCOUNT_OFFER:EMAIL:ar': {
    subject: 'عرض حصري لك، {name}',
    body: `<p>مرحبًا {name}،</p>
<p>لديك خصم حصري. استخدم الكود <strong>{discountCode}</strong> في طلبك القادم.</p>
<p><a href="{link}">تسوّق الآن</a></p>`
  },
  'DISCOUNT_OFFER:WHATSAPP:en': {
    body: 'Hi {name}, here is your exclusive code: {discountCode} — shop now: {link}'
  },
  'DISCOUNT_OFFER:WHATSAPP:fa': {
    body: 'سلام {name}، کد تخفیف اختصاصی شما: {discountCode} — همین الان خرید کنید: {link}'
  },
};

/**
 * Resolve a built-in template through a 4-step fallback chain:
 *
 *   1. exact (event, channel, locale, segment)
 *   2. (event, channel, locale, ALL)
 *   3. (event, channel, en, segment)
 *   4. (event, channel, en, ALL)
 *
 * Returning null means there is no copy for this event at all, which
 * makes `dispatchAutomation` log a SKIPPED row and bail.
 */
export function getDefaultTemplate(
  eventType: AutomationEventType,
  channel: AutomationChannel,
  locale: string,
  segment: CustomerSegment = 'ALL' as CustomerSegment
): TemplateSeed | null {
  const tries: Key[] = [
    `${eventType}:${channel}:${locale}:${segment}`,
    `${eventType}:${channel}:${locale}`, // implicit ALL
    `${eventType}:${channel}:en:${segment}`,
    `${eventType}:${channel}:en`
  ];
  for (const k of tries) {
    if (T[k]) return T[k];
  }
  return null;
}

export function listAllSeedKeys(): {
  eventType: AutomationEventType;
  channel: AutomationChannel;
  locale: string;
}[] {
  // Only return the (event,channel,locale) tuples for the admin UI;
  // segment-specific seeds aren't editable through that panel yet.
  const seen = new Set<string>();
  const out: {
    eventType: AutomationEventType;
    channel: AutomationChannel;
    locale: string;
  }[] = [];
  for (const k of Object.keys(T)) {
    const parts = k.split(':');
    if (parts.length > 3) continue;
    const [eventType, channel, locale] = parts as [
      AutomationEventType,
      AutomationChannel,
      string
    ];
    const key = `${eventType}:${channel}:${locale}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ eventType, channel, locale });
  }
  return out;
}
