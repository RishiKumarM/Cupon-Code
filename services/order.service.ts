import { OrderRepository } from "@/repositories/order.repository";
import { CouponRepository } from "@/repositories/coupon.repository";
import { decryptCode } from "@/lib/crypto.server";
import { Order, RevealedCoupon } from "@/types";

export class OrderService {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly couponRepo: CouponRepository
  ) {}

  async getUserOrders(user_id: string) {
    return this.orderRepo.findByUser(user_id);
  }

  /**
   * Reveals the decrypted coupon code ONLY if:
   * 1. The user has a successful order for the given coupon
   * 2. The coupon exists and has the encrypted code
   */
  async revealCouponCode(
    user_id: string,
    coupon_id: string
  ): Promise<RevealedCoupon> {
    // Verify user has a successful order
    const order = await this.orderRepo.findByUserAndCoupon(user_id, coupon_id);
    if (!order) {
      throw new Error("No successful purchase found for this coupon");
    }

    // Fetch coupon with encrypted code (admin client required)
    const coupon = await this.couponRepo.findByIdWithCode(coupon_id);
    if (!coupon || !coupon.coupon_code_encrypted) {
      throw new Error("Coupon not found");
    }

    const coupon_code = decryptCode(coupon.coupon_code_encrypted);

    return {
      order_id: order.id,
      coupon_id,
      coupon_code,
      brand_name: coupon.brand_name,
      title: coupon.title,
    };
  }

  async getOrderById(id: string): Promise<Order | null> {
    return this.orderRepo.findById(id);
  }
}
