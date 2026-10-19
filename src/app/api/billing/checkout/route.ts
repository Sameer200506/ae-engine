import { fail, handleError, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { run } from "@/lib/db";
import { appUrl, priceIdForPlan, stripe, stripeEnabled } from "@/lib/stripe";
import { getPlan, PAID_PLANS, type PlanId } from "@/lib/plans";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson<{ plan?: string }>(request);
    const planId = (body.plan ?? "pro") as PlanId;

    if (!PAID_PLANS.includes(planId)) return fail(400, "Unknown plan.");

    if (!stripeEnabled()) {
      return fail(
        503,
        "Billing is not configured yet. Set STRIPE_SECRET_KEY and STRIPE_PRICE_PRO in your .env file.",
      );
    }

    const priceId = priceIdForPlan(planId);
    if (!priceId) {
      return fail(
        503,
        `No Stripe price configured for the ${getPlan(planId).name} plan. Set ${planId === "pro" ? "STRIPE_PRICE_PRO" : "STRIPE_PRICE_SCALE"} in your .env file.`,
      );
    }

    const client = stripe();

    // Reuse the customer across upgrades so the billing portal stays coherent.
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await client.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      run("UPDATE users SET stripe_customer_id = ? WHERE id = ?", [customerId, user.id]);
    }

    const session = await client.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl()}/dashboard/billing?checkout=success`,
      cancel_url: `${appUrl()}/pricing?checkout=cancelled`,
      client_reference_id: user.id,
      allow_promotion_codes: true,
      metadata: { userId: user.id, plan: planId },
      subscription_data: { metadata: { userId: user.id, plan: planId } },
    });

    if (!session.url) return fail(500, "Stripe did not return a checkout URL.");
    return ok({ url: session.url });
  } catch (error) {
    return handleError(error);
  }
}
