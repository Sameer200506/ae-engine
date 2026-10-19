import "server-only";

import Stripe from "stripe";
import type { PlanId } from "./plans";

/**
 * Stripe wiring. Everything is optional: with no keys set the app runs in
 * "no billing" mode and the upgrade buttons explain what to configure.
 */

export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }
  if (!client) {
    // apiVersion is intentionally omitted so the SDK uses its own pinned version.
    client = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return client;
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Map a Stripe price id back to one of our plans. */
export function planForPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_SCALE) return "scale";
  return null;
}

export function priceIdForPlan(plan: PlanId): string | null {
  if (plan === "pro") return process.env.STRIPE_PRICE_PRO || null;
  if (plan === "scale") return process.env.STRIPE_PRICE_SCALE || null;
  return null;
}

export function planFromSubscription(subscription: Stripe.Subscription): PlanId {
  const priceId = subscription.items.data[0]?.price?.id;
  const mapped = planForPriceId(priceId);
  if (mapped) return mapped;
  // Fall back to subscription metadata if the price id is not configured here.
  const meta = subscription.metadata?.plan;
  if (meta === "pro" || meta === "scale") return meta;
  return "free";
}

export function subscriptionIsActive(status: Stripe.Subscription.Status): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
}

export type { Stripe };
