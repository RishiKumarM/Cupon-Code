import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CouponRepository } from "@/repositories/coupon.repository";
import { OrderRepository } from "@/repositories/order.repository";
import { OrderService } from "@/services/order.service";
import { rateLimit } from "@/lib/rate-limit";

const revealSchema = z.object({
  coupon_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  // Strict rate limiting for reveal endpoint
  const ip = req.headers.get("x-forwarded-for") ?? "anon";
  const rl = rateLimit(`reveal:${ip}`, { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Authenticate
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

  const parse = revealSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const couponRepo = new CouponRepository(adminClient);
    const orderRepo = new OrderRepository(adminClient);
    const orderService = new OrderService(orderRepo, couponRepo);

    const revealed = await orderService.revealCouponCode(
      user.id,
      parse.data.coupon_id
    );

    return NextResponse.json(revealed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const isAuthError = message.includes("No successful purchase");
    return NextResponse.json(
      { error: message },
      { status: isAuthError ? 403 : 500 }
    );
  }
}
