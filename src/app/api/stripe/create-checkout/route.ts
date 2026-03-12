import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, PLANS, TOPOFF_PACKAGES } from "@/lib/stripe";

export async function GET(req: NextRequest) {
  return handleCheckout(req);
}

export async function POST(req: NextRequest) {
  return handleCheckout(req);
}

async function handleCheckout(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const url = new URL(req.url);
    const typeParam = url.searchParams.get("type"); // "subscription" (default) or "topoff"
    const planParam = (url.searchParams.get("plan") || "closer") as "closer" | "setter";
    const packageParam = url.searchParams.get("package"); // "10" or "25" for topoffs

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, email")
      .eq("id", user.id)
      .single();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // ── Top-off: one-time purchase of extra rollover calls ───────────────────
    if (typeParam === "topoff") {
      const packages = TOPOFF_PACKAGES[planParam];
      if (!packages) {
        return NextResponse.json({ error: "Invalid plan for top-off" }, { status: 400 });
      }

      const pkg = packages.find((p) => String(p.calls) === packageParam);
      if (!pkg) {
        return NextResponse.json({ error: "Invalid top-off package" }, { status: 400 });
      }

      if (!pkg.priceId) {
        return NextResponse.json({ error: "Top-off price not configured" }, { status: 503 });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        customer: profile?.stripe_customer_id || undefined,
        customer_email: !profile?.stripe_customer_id ? (user.email || undefined) : undefined,
        line_items: [{ price: pkg.priceId, quantity: 1 }],
        success_url: `${appUrl}/dashboard?tab=settings&topoff=success`,
        cancel_url:  `${appUrl}/dashboard?tab=settings`,
        metadata: {
          user_id: user.id,
          type:    "topoff",
          plan:    planParam,
          calls:   String(pkg.calls),
        },
      });

      return NextResponse.redirect(session.url!);
    }

    // ── Subscription: recurring monthly plan ─────────────────────────────────
    const plan = planParam as keyof typeof PLANS;

    if (!PLANS[plan]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: profile?.stripe_customer_id || undefined,
      customer_email: !profile?.stripe_customer_id ? (user.email || undefined) : undefined,
      line_items: [{ price: PLANS[plan].priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?billing=success`,
      cancel_url:  `${appUrl}/dashboard?tab=settings`,
      metadata: {
        user_id: user.id,
        plan,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan,
        },
      },
    });

    return NextResponse.redirect(session.url!);
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
