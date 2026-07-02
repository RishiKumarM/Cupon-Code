import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CouponRepository } from "@/repositories/coupon.repository";
import { CouponService } from "@/services/coupon.service";
import { rateLimit } from "@/lib/rate-limit";

const filtersSchema = z.object({
  category: z.string().optional(),
  search: z.string().max(100).optional(),
  status: z.enum(["available", "sold"]).optional(),
});

export const revalidate = 30; // cache public listing for 30 seconds

export async function GET(req: NextRequest) {
  // Rate limiting
  const ip = req.headers.get("x-forwarded-for") ?? "anon";
  const rl = rateLimit(`coupons:${ip}`, { limit: 60, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  const { searchParams } = new URL(req.url);
  const parse = filtersSchema.safeParse({
    category: searchParams.get("category") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });

  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const repo = new CouponRepository(supabase);
    const service = new CouponService(repo);
    const [coupons, categories] = await Promise.all([
      service.listCoupons(parse.data),
      service.getCategories(),
    ]);
    return NextResponse.json({ coupons, categories });
  } catch (err) {
    console.error("[GET /api/coupons]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
