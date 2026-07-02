import { SupabaseClient } from "@supabase/supabase-js";
import { PublicCoupon } from "@/types";

export interface CouponFilters {
  category?: string;
  search?: string;
  status?: "available" | "sold";
}

/**
 * CouponRepository — data-access layer.
 * Never returns coupon_code_encrypted to callers.
 */
export class CouponRepository {
  constructor(private readonly db: SupabaseClient) {}

  /** Fetch public coupon listing (no encrypted code) */
  async findAll(filters: CouponFilters = {}): Promise<PublicCoupon[]> {
    let query = this.db
      .from("coupons")
      .select(
        "id,brand_name,category,title,expiry_date,terms_and_conditions,price,masked_code,status,created_at,updated_at"
      )
      .order("created_at", { ascending: false });

    if (filters.status) {
      query = query.eq("status", filters.status);
    }

    if (filters.category && filters.category !== "All") {
      query = query.eq("category", filters.category);
    }

    if (filters.search) {
      query = query.or(
        `title.ilike.%${filters.search}%,brand_name.ilike.%${filters.search}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data as PublicCoupon[]) ?? [];
  }

  /** Fetch single public coupon (no encrypted code) */
  async findById(id: string): Promise<PublicCoupon | null> {
    const { data, error } = await this.db
      .from("coupons")
      .select(
        "id,brand_name,category,title,expiry_date,terms_and_conditions,price,masked_code,status,created_at,updated_at"
      )
      .eq("id", id)
      .single();
    if (error) return null;
    return data as PublicCoupon;
  }

  /** Fetch coupon including encrypted code — server admin use only */
  async findByIdWithCode(id: string) {
    const { data, error } = await this.db
      .from("coupons")
      .select("*")
      .eq("id", id)
      .single();
    if (error) return null;
    return data;
  }

  /** Insert a new coupon (admin only) */
  async create(input: {
    brand_name: string;
    category: string;
    title: string;
    expiry_date: string;
    terms_and_conditions: string[];
    price: number;
    coupon_code_encrypted: string;
    masked_code: string;
    status?: "available" | "sold";
  }): Promise<PublicCoupon> {
    const { data, error } = await this.db
      .from("coupons")
      .insert({ ...input, status: input.status ?? "available" })
      .select(
        "id,brand_name,category,title,expiry_date,terms_and_conditions,price,masked_code,status,created_at,updated_at"
      )
      .single();
    if (error) throw error;
    return data as PublicCoupon;
  }

  /** Mark coupon as sold */
  async markSold(id: string): Promise<void> {
    const { error } = await this.db
      .from("coupons")
      .update({ status: "sold", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }

  /** Get available categories */
  async getCategories(): Promise<string[]> {
    const { data, error } = await this.db
      .from("coupons")
      .select("category");
    if (error) return [];
    const unique = [...new Set((data ?? []).map((r: { category: string }) => r.category))];
    return unique;
  }
}
