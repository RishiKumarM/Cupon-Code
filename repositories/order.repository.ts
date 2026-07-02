import { SupabaseClient } from "@supabase/supabase-js";
import { Order, OrderWithCoupon, PaymentStatus } from "@/types";

export class OrderRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findById(id: string): Promise<Order | null> {
    const { data, error } = await this.db
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();
    if (error) return null;
    return data as Order;
  }

  async findByRazorpayOrderId(razorpay_order_id: string): Promise<Order | null> {
    const { data, error } = await this.db
      .from("orders")
      .select("*")
      .eq("razorpay_order_id", razorpay_order_id)
      .single();
    if (error) return null;
    return data as Order;
  }

  async findByUserAndCoupon(
    user_id: string,
    coupon_id: string
  ): Promise<Order | null> {
    const { data, error } = await this.db
      .from("orders")
      .select("*")
      .eq("user_id", user_id)
      .eq("coupon_id", coupon_id)
      .eq("payment_status", "success")
      .maybeSingle();
    if (error) return null;
    return data as Order | null;
  }

  async findByUser(user_id: string): Promise<OrderWithCoupon[]> {
    const { data, error } = await this.db
      .from("orders")
      .select(
        `*,
        coupon:coupons(id,brand_name,category,title,expiry_date,terms_and_conditions,price,masked_code,status,created_at,updated_at)`
      )
      .eq("user_id", user_id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as OrderWithCoupon[]) ?? [];
  }

  async create(input: {
    user_id: string;
    coupon_id: string;
    razorpay_order_id: string;
    amount: number;
    currency?: string;
    payment_status?: PaymentStatus;
  }): Promise<Order> {
    const { data, error } = await this.db
      .from("orders")
      .insert({
        ...input,
        currency: input.currency ?? "INR",
        payment_status: input.payment_status ?? "pending",
      })
      .select("*")
      .single();
    if (error) throw error;
    return data as Order;
  }

  async updatePaymentStatus(
    id: string,
    payment_status: PaymentStatus,
    updates: {
      payment_id?: string;
      razorpay_signature?: string;
    } = {}
  ): Promise<void> {
    const { error } = await this.db
      .from("orders")
      .update({
        payment_status,
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
  }
}
