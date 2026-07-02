import { CouponRepository, CouponFilters } from "@/repositories/coupon.repository";
import { encryptCode, maskCode } from "@/lib/crypto.server";
import { PublicCoupon } from "@/types";

export class CouponService {
  constructor(private readonly couponRepo: CouponRepository) {}

  async listCoupons(filters: CouponFilters = {}): Promise<PublicCoupon[]> {
    return this.couponRepo.findAll(filters);
  }

  async getCoupon(id: string): Promise<PublicCoupon | null> {
    return this.couponRepo.findById(id);
  }

  async getCategories(): Promise<string[]> {
    return this.couponRepo.getCategories();
  }

  async createCoupon(input: {
    brand_name: string;
    category: string;
    title: string;
    expiry_date: string;
    terms_and_conditions: string[];
    price: number;
    coupon_code: string; // raw, will be encrypted
  }): Promise<PublicCoupon> {
    const coupon_code_encrypted = encryptCode(input.coupon_code);
    const masked_code = maskCode(input.coupon_code);

    return this.couponRepo.create({
      brand_name: input.brand_name,
      category: input.category,
      title: input.title,
      expiry_date: input.expiry_date,
      terms_and_conditions: input.terms_and_conditions,
      price: input.price,
      coupon_code_encrypted,
      masked_code,
      status: "available",
    });
  }
}
