import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CouponRepository } from "@/repositories/coupon.repository";
import { OrderRepository } from "@/repositories/order.repository";
import { PaymentService } from "@/services/payment.service";
import { rateLimit } from "@/lib/rate-limit";

const createOrderSchema = z.object({
  coupon_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = req.headers.get("x-forwarded-for") ?? "anon";
  const rl = rateLimit(`create-order:${ip}`, { limit: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Authenticate user
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parse = createOrderSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const couponRepo = new CouponRepository(adminClient);
    const orderRepo = new OrderRepository(adminClient);
    const paymentService = new PaymentService(orderRepo, couponRepo);

    const result = await paymentService.createPaymentOrder(
      user.id,
      parse.data.coupon_id
    );

    return NextResponse.json({
      razorpay_order_id: result.razorpay_order.id,
      amount: result.razorpay_order.amount,
      currency: result.razorpay_order.currency,
      order_id: result.order_id,
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const isClientError = ["already purchased", "already sold", "not found"].some(
      (s) => message.toLowerCase().includes(s)
    );
    return NextResponse.json(
      { error: message },
      { status: isClientError ? 400 : 500 }
    );
  }
}
