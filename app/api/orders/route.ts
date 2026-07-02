import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { OrderRepository } from "@/repositories/order.repository";
import { OrderService } from "@/services/order.service";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const couponRepo = {
      findById: async () => null,
      findByIdWithCode: async () => null,
      findAll: async () => [],
      create: async () => { throw new Error("not used"); },
      markSold: async () => {},
      getCategories: async () => [],
    };
    const orderRepo = new OrderRepository(adminClient);
    const orderService = new OrderService(orderRepo, couponRepo as never);
    const orders = await orderService.getUserOrders(user.id);
    return NextResponse.json({ orders });
  } catch (err) {
    console.error("[GET /api/orders]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
