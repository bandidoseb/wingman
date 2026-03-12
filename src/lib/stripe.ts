import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
  typescript: true,
});

export const PLANS = {
  closer: {
    name: "Closer — Core",
    priceId: process.env.STRIPE_CLOSER_PRICE_ID!,
    price: "$149/mo",
    calls: 80,
    extraCallPrice: "$1.00",
  },
  setter: {
    name: "Setter — Core",
    priceId: process.env.STRIPE_SETTER_PRICE_ID!,
    price: "$79/mo",
    calls: 150,
    extraCallPrice: "$0.50",
  },
  assist: {
    name: "Wingman Assist",
    priceId: process.env.STRIPE_ASSIST_PRICE_ID!,
    price: "$50/mo",
  },
} as const;

/**
 * One-time top-off packages — extra calls that roll over month to month
 * until fully used. Priced per the plan's extraCallPrice rate.
 * Create these as one-time prices in your Stripe dashboard, then add
 * the price IDs to your .env.local.
 */
export const TOPOFF_PACKAGES: Record<"closer" | "setter", Array<{ calls: number; price: string; priceId: string }>> = {
  closer: [
    { calls: 10, price: "$10", priceId: process.env.STRIPE_CLOSER_TOPOFF_10_PRICE_ID! },
    { calls: 25, price: "$25", priceId: process.env.STRIPE_CLOSER_TOPOFF_25_PRICE_ID! },
  ],
  setter: [
    { calls: 10, price: "$5",  priceId: process.env.STRIPE_SETTER_TOPOFF_10_PRICE_ID! },
    { calls: 25, price: "$13", priceId: process.env.STRIPE_SETTER_TOPOFF_25_PRICE_ID! },
  ],
};
