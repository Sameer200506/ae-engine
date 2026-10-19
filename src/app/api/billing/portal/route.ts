import { fail, handleError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { appUrl, stripe, stripeEnabled } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await requireUser();

    if (!stripeEnabled()) return fail(503, "Billing is not configured on this deployment.");
    if (!user.stripe_customer_id) {
      return fail(400, "No billing account yet. Choose a plan first.");
    }

    const session = await stripe().billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${appUrl()}/dashboard/billing`,
    });

    return ok({ url: session.url });
  } catch (error) {
    return handleError(error);
  }
}
