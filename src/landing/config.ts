// Everything on the landing page that a non-developer may need to change lives here.

/** Where the buttons go. Each is a route in this app unless it starts with http. */
export const CTA = {
  /** "Get Started" and the plan buttons: the sign-up form. The 14 day trial starts when a firm is set up. */
  getStarted: '/signup',
  signIn: '/signin',
  /** "Explore Features" and "Explore the Platform": a section of this page. */
  explore: '#features',
};

/**
 * The hero photograph, shown on the right of the hero and fading into the page on its left.
 * To replace it: overwrite public/landing/hero.jpg (people towards the right, at least 1200 px wide)
 * and update width and height. Keep alt as a plain description of the picture.
 */
export const HERO = {
  src: '/landing/hero.jpg',
  alt: 'Three accounting professionals in dark suits reviewing a printed financial report together',
  width: 792,
  height: 656,
  /** true shows the labelled placeholder layout instead of a full-bleed photograph */
  placeholder: false,
};

/**
 * Pages and contact details that have not been supplied. Leave a value as null and the footer
 * shows the item as "to be published" instead of a dead link. The contact email is taken from
 * the support email set in the admin console when one is set there.
 */
export const LINKS: { privacy: string | null; terms: string | null; contactEmail: string | null } = {
  privacy: null,
  terms: null,
  contactEmail: null,
};

/**
 * Prices. The live price list comes from the database, where the admin console edits it,
 * so the landing page and the checkout never disagree. This is only the fallback shown if
 * the price list cannot be loaded. Leave a price as null to show "Contact us for pricing".
 * A blank (null) user allowance means unlimited users. A blank price never means free.
 */
export const FALLBACK_PRICING: {
  plans: { code: string; name: string; priceNaira: number | null; users: number | null; engagements: number | null }[];
  engagements: { code: string; priceNaira: number | null }[];
} = {
  plans: [
    { code: 'solo', name: 'Solo', priceNaira: null, users: null, engagements: null },
    { code: 'practice', name: 'Practice', priceNaira: null, users: null, engagements: null },
    { code: 'firm', name: 'Firm', priceNaira: null, users: null, engagements: null },
  ],
  engagements: [
    { code: 'compilation', priceNaira: null },
    { code: 'review', priceNaira: null },
    { code: 'audit', priceNaira: null },
    { code: 'group', priceNaira: null },
  ],
};

/** Shown on each plan while founding places remain. Set to null to hide it. */
export const FOUNDING_BADGE: string | null = 'Founding firms save 40% in year one';
/** Founding firms pay this share of the price in their first year. */
export const FOUNDING_PERCENT_OF_PRICE = 60;
