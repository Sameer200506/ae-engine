import { fail, ok } from "@/lib/api";
import { get, run } from "@/lib/db";
import {
  planFromSubscription,
  stripe,
  stripeEnabled,
  subscriptionIsActive,
  type Stripe,
} from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook receiver.
 *
 * This is the only place subscription state is trusted: the client-side success
 * redirect can be spoofed, a signed webhook cannot. Test locally with:
 *   stripe listen --forward-to localhost:3000/api/stripe/webhook
 */
export async function POST(request: Request) {
  if (!stripeEnabled()) return fail(503, "Billing is not configured.");

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return fail(503, "STRIPE_WEBHOOK_SECRET is not set.");

  const signature = request.headers.get("stripe-signature");
  if (!signature) return fail(400, "Missing stripe-signature header.");

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    // Never 500 here: Stripe would retry a request we can never verify.
    return fail(400, `Signature verification failed: ${error instanceof Error ? error.message : "unknown"}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId ?? session.client_reference_id;
        if (userId) {
          const plan = session.metadata?.plan === "scale" ? "scale" : "pro";
          run(
            "UPDATE users SET plan = ?, stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?",
            [plan, asId(session.customer), asId(session.subscription), userId],
          );
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const plan = subscriptionIsActive(subscription.status)
          ? planFromSubscription(subscription)
          : "free";
        applySubscription(subscription, plan);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        applySubscription(subscription, "free");
        break;
      }

      case "invoice.payment_failed": {
        // Leave the plan alone (Stripe retries), but note the lapse.
        console.warn("[stripe] payment failed for invoice", (event.data.object as Stripe.Invoice).id);
        break;
      }

      default:
        break;
    }

    return ok({ received: true });
  } catch (error) {
    console.error("[stripe] webhook handler error:", error);
    // Return 500 so Stripe retries a genuine processing failure.
    return fail(500, "Webhook processing failed.");
  }
}

function asId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function applySubscription(subscription: Stripe.Subscription, plan: string): void {
  const customerId = asId(subscription.customer);
  const metadataUserId = subscription.metadata?.userId;

  const renewsAt =
    "current_period_end" in subscription && typeof subscription.current_period_end === "number"
      ? subscription.current_period_end * 1000
      : null;

  if (metadataUserId) {
    run(
      "UPDATE users SET plan = ?, stripe_customer_id = ?, stripe_subscription_id = ?, plan_renews_at = ? WHERE id = ?",
      [plan, customerId, subscription.id, renewsAt, metadataUserId],
    );
    return;
  }

  if (!customerId) return;
  const existing = get<{ id: string }>("SELECT id FROM users WHERE stripe_customer_id = ?", [customerId]);
  if (existing) {
    run(
      "UPDATE users SET plan = ?, stripe_subscription_id = ?, plan_renews_at = ? WHERE id = ?",
      [plan, subscription.id, renewsAt, existing.id],
    );
  }
}
