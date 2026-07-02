import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CouponRepository } from "@/repositories/coupon.repository";
import { CouponService } from "@/services/coupon.service";

const createCouponSchema = z.object({
  brand_name: z.string().min(1).max(100),
  category: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format"),
  terms_and_conditions: z.array(z.string().min(1)).min(1).max(20),
  price: z.number().positive().max(10000),
  coupon_code: z.string().min(1).max(100),
});

function isAdmin(user: { app_metadata?: Record<string, unknown>; role?: string }): boolean {
  const role =
    (user.app_metadata?.role as string) ??
    user.role ??
    "";
  return role === "admin";
}

export async function POST(req: NextRequest) {
  // Authenticate and check admin role
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parse = createCouponSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const repo = new CouponRepository(adminClient);
    const service = new CouponService(repo);
    const coupon = await service.createCoupon(parse.data);
    return NextResponse.json(coupon, { status: 201 });
  } catch (err) {
    console.error("[POST /api/admin/coupons]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
