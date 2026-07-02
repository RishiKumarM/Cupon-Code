import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/razorpay.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CouponRepository } from "@/repositories/coupon.repository";
import { OrderRepository } from "@/repositories/order.repository";
import { PaymentService } from "@/services/payment.service";

// Disable body parsing so we can read the raw body for HMAC verification
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-razorpay-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await req.text();

  // Verify webhook signature BEFORE processing
  let isValid: boolean;
  try {
    isValid = verifyWebhookSignature(rawBody, signature);
  } catch (err) {
    console.error("[Webhook] Signature verification error:", err);
    return NextResponse.json({ error: "Configuration error" }, { status: 500 });
  }

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: {
    event: string;
    payload: {
      payment?: {
        entity: {
          id: string;
          order_id: string;
          status: string;
        };
      };
    };
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const couponRepo = new CouponRepository(adminClient);
    const orderRepo = new OrderRepository(adminClient);
    const paymentService = new PaymentService(orderRepo, couponRepo);

    const { event: eventType, payload } = event;

    if (eventType === "payment.captured" && payload.payment?.entity) {
      const { id: payment_id, order_id: razorpay_order_id } =
        payload.payment.entity;
      // Idempotent fulfillment
      await paymentService.fulfillFromWebhook(razorpay_order_id, payment_id);
    } else if (eventType === "payment.failed" && payload.payment?.entity) {
      const { order_id: razorpay_order_id } = payload.payment.entity;
      await paymentService.failOrder(razorpay_order_id);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[Webhook] Processing error:", err);
    // Return 200 to prevent Razorpay from retrying for non-retryable errors
    return NextResponse.json({ received: true, warning: "Processing error" });
  }
}
