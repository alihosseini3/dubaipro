/**
 * Smart Media Presets — centralised image context definitions.
 *
 * Each preset maps a logical name to:
 *   - maxDimension   : longest edge for the master/original variant
 *   - quality        : WebP/AVIF encoding quality (0-100)
 *   - skipAvif       : skip expensive AVIF encode for UI-heavy admin contexts
 *   - sizes          : default CSS sizes attribute for srcset selection
 *   - aspectRatio    : expected display aspect ratio (informational)
 *   - folder         : default upload folder
 *   - altRequired    : whether missing alt should be flagged as an error
 *   - keywords       : whether keywords are expected for SEO scoring
 */

export interface MediaPreset {
  id:            string;
  label:         string;
  maxDimension:  number;
  quality:       number;
  skipAvif?:     boolean;
  sizes:         string;
  aspectRatio?:  string;   // e.g. "1/1", "16/9"
  folder:        string;
  altRequired:   boolean;
  keywordsExpected: boolean;
}

const PRESETS: Record<string, MediaPreset> = {
  'product-cover': {
    id:               'product-cover',
    label:            'Product cover image',
    maxDimension:     1600,
    quality:          82,
    sizes:            '(max-width:640px) 100vw, (max-width:1024px) 50vw, 600px',
    aspectRatio:      '1/1',
    folder:           'products',
    altRequired:      true,
    keywordsExpected: true,
  },
  'product-thumb': {
    id:               'product-thumb',
    label:            'Product thumbnail',
    maxDimension:     800,
    quality:          80,
    sizes:            '(max-width:640px) 45vw, (max-width:1024px) 22vw, 200px',
    aspectRatio:      '1/1',
    folder:           'products',
    altRequired:      true,
    keywordsExpected: false,
  },
  'product-gallery': {
    id:               'product-gallery',
    label:            'Product gallery image',
    maxDimension:     2400,
    quality:          85,
    sizes:            '(max-width:768px) 100vw, 1200px',
    folder:           'products',
    altRequired:      true,
    keywordsExpected: false,
  },
  'category-grid': {
    id:               'category-grid',
    label:            'Category grid image',
    maxDimension:     1200,
    quality:          80,
    sizes:            '(max-width:640px) 100vw, (max-width:1024px) 50vw, 400px',
    aspectRatio:      '4/3',
    folder:           'categories',
    altRequired:      true,
    keywordsExpected: true,
  },
  'hero-banner': {
    id:               'hero-banner',
    label:            'Hero / banner image',
    maxDimension:     2560,
    quality:          88,
    sizes:            '100vw',
    aspectRatio:      '21/9',
    folder:           'banners',
    altRequired:      false,
    keywordsExpected: false,
  },
  'supplier-logo': {
    id:               'supplier-logo',
    label:            'Supplier / brand logo',
    maxDimension:     400,
    quality:          90,
    skipAvif:         true,
    sizes:            '80px',
    aspectRatio:      '1/1',
    folder:           'brands',
    altRequired:      true,
    keywordsExpected: false,
  },
  'supplier-banner': {
    id:               'supplier-banner',
    label:            'Supplier profile banner',
    maxDimension:     2000,
    quality:          82,
    sizes:            '100vw',
    aspectRatio:      '4/1',
    folder:           'brands',
    altRequired:      false,
    keywordsExpected: false,
  },
  'avatar': {
    id:               'avatar',
    label:            'User avatar',
    maxDimension:     400,
    quality:          85,
    skipAvif:         true,
    sizes:            '40px',
    aspectRatio:      '1/1',
    folder:           'avatars',
    altRequired:      false,
    keywordsExpected: false,
  },
  'blog-cover': {
    id:               'blog-cover',
    label:            'Blog / article cover',
    maxDimension:     1600,
    quality:          84,
    sizes:            '(max-width:768px) 100vw, 800px',
    aspectRatio:      '16/9',
    folder:           'blog',
    altRequired:      true,
    keywordsExpected: true,
  },
  'general': {
    id:               'general',
    label:            'General purpose',
    maxDimension:     2400,
    quality:          82,
    sizes:            '(max-width:640px) 100vw, 800px',
    folder:           'general',
    altRequired:      false,
    keywordsExpected: false,
  },
};

/** Return the preset by id, falling back to 'general'. */
export function getPreset(id: string): MediaPreset {
  return PRESETS[id] ?? PRESETS['general']!;
}

/** All preset ids in display order. */
export const PRESET_IDS = Object.keys(PRESETS);

/** All presets as an array. */
export const ALL_PRESETS = Object.values(PRESETS);

/** Derive the best preset from a MediaContext key. */
export function presetFromContext(context: string | null | undefined): MediaPreset {
  if (!context) return PRESETS['general']!;
  const map: Record<string, string> = {
    'product-cover':   'product-cover',
    'product-gallery': 'product-gallery',
    'hero':            'hero-banner',
    'hero-banner':     'hero-banner',
    'category':        'category-grid',
    'category-grid':   'category-grid',
    'blog':            'blog-cover',
    'brand':           'supplier-logo',
    'supplier':        'supplier-logo',
    'avatar':          'avatar',
    'banner':          'hero-banner',
  };
  const key = map[context] ?? context;
  return PRESETS[key] ?? PRESETS['general']!;
}
