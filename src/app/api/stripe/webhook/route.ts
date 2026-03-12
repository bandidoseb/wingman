import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import Stripe from "stripe";

// Required: disable Next.js body parser for Stripe webhooks
export const config = {
  api: { bodyParser: false },
};

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Webhook signature error:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServiceClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;

        if (!userId) break;

        // ── Top-off purchase: add rollover calls, don't touch subscription ──
        if (session.metadata?.type === "topoff") {
          const callsToAdd = parseInt(session.metadata?.calls ?? "0", 10);
          if (callsToAdd > 0) {
            const { data: current } = await supabase
              .from("profiles")
              .select("extra_calls_remaining")
              .eq("id", userId)
              .single();
            await supabase
              .from("profiles")
              .update({
                extra_calls_remaining: (current?.extra_calls_remaining ?? 0) + callsToAdd,
              })
              .eq("id", userId);
          }
          break;
        }

        // ── New subscription: activate account, reset free-trial counter ──
        const plan = session.metadata?.plan;
        await supabase
          .from("profiles")
          .update({
            stripe_customer_id:     session.customer as string,
            stripe_subscription_id: session.subscription as string,
            subscription_status:    "active",
            subscription_plan:      plan,
            calls_used:             0,
          })
          .eq("id", userId);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.user_id;

        if (!userId) {
          // Try to look up by customer_id
          const { data } = await supabase
            .from("profiles")
            .select("id")
            .eq("stripe_subscription_id", sub.id)
            .single();
          if (data) {
            await supabase
              .from("profiles")
              .update({
                subscription_status: sub.status,
                subscription_plan: sub.metadata?.plan || null,
              })
              .eq("id", data.id);
          }
          break;
        }

        await supabase
          .from("profiles")
          .update({
            subscription_status: sub.status,
            subscription_plan: sub.metadata?.plan || null,
          })
          .eq("id", userId);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const { data } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_subscription_id", sub.id)
          .single();

        if (data) {
          await supabase
            .from("profiles")
            .update({
              subscription_status: "canceled",
              subscription_plan: null,
              stripe_subscription_id: null,
            })
            .eq("id", data.id);
        }
        break;
      }

      case "invoice.paid": {
        // Fires on every successful renewal — reset monthly call counter
        const invoice = event.data.object as Stripe.Invoice;
        const subId = (invoice as { subscription?: string }).subscription;
        // Only reset for subscription renewals, not the initial checkout invoice
        // (checkout.session.completed already handles that one)
        const billingReason = (invoice as { billing_reason?: string }).billing_reason;
        if (!subId || billingReason === "subscription_create") break;

        const { data } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_subscription_id", subId)
          .single();

        if (data) {
          await supabase
            .from("profiles")
            .update({
              calls_used: 0,
              subscription_status: "active",
            })
            .eq("id", data.id);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = (invoice as { subscription?: string }).subscription;
        if (!subId) break;

        const { data } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_subscription_id", subId)
          .single();

        if (data) {
          await supabase
            .from("profiles")
            .update({ subscription_status: "past_due" })
            .eq("id", data.id);
        }
        break;
      }

      default:
        // Unhandled event type — OK
        break;
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    // Still return 200 so Stripe doesn't retry
  }

  return NextResponse.json({ received: true });
}
