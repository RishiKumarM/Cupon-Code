import { getRazorpay, verifyPaymentSignature } from "@/lib/razorpay.server";
import { OrderRepository } from "@/repositories/order.repository";
import { CouponRepository } from "@/repositories/coupon.repository";
import { RazorpayOrder } from "@/types";

export class PaymentService {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly couponRepo: CouponRepository
  ) {}

  /**
   * Creates a Razorpay order and a pending DB order record.
   * Returns the Razorpay order details needed by the client SDK.
   */
  async createPaymentOrder(
    user_id: string,
    coupon_id: string
  ): Promise<{ razorpay_order: RazorpayOrder; order_id: string }> {
    const coupon = await this.couponRepo.findById(coupon_id);
    if (!coupon) throw new Error("Coupon not found");
    if (coupon.status === "sold") throw new Error("Coupon is already sold");

    // Check for existing successful order (idempotency)
    const existing = await this.orderRepo.findByUserAndCoupon(
      user_id,
      coupon_id
    );
    if (existing) {
      throw new Error("You have already purchased this coupon");
    }

    const razorpay = getRazorpay();
    const amountInPaise = Math.round(coupon.price * 100); // Razorpay uses paise

    const razorpay_order = (await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `order_${Date.now()}`,
    })) as unknown as RazorpayOrder;

    // Persist pending order
    const order = await this.orderRepo.create({
      user_id,
      coupon_id,
      razorpay_order_id: razorpay_order.id,
      amount: coupon.price,
      currency: "INR",
    });

    return { razorpay_order, order_id: order.id };
  }

  /**
   * Verifies payment signature from client callback and marks order success.
   * Returns false if signature verification fails.
   */
  async verifyAndFulfill(
    razorpay_order_id: string,
    razorpay_payment_id: string,
    razorpay_signature: string
  ): Promise<{ success: boolean; order_id?: string; coupon_id?: string }> {
    const isValid = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return { success: false };
    }

    const order = await this.orderRepo.findByRazorpayOrderId(razorpay_order_id);
    if (!order) return { success: false };

    // Idempotent: already succeeded
    if (order.payment_status === "success") {
      return { success: true, order_id: order.id, coupon_id: order.coupon_id };
    }

    await this.orderRepo.updatePaymentStatus(order.id, "success", {
      payment_id: razorpay_payment_id,
      razorpay_signature,
    });

    // Mark coupon as sold
    await this.couponRepo.markSold(order.coupon_id);

    return { success: true, order_id: order.id, coupon_id: order.coupon_id };
  }

  /**
   * Handles webhook-based fulfillment (idempotent).
   * Called only after webhook signature is verified upstream.
   */
  async fulfillFromWebhook(
    razorpay_order_id: string,
    razorpay_payment_id: string
  ): Promise<void> {
    const order = await this.orderRepo.findByRazorpayOrderId(razorpay_order_id);
    if (!order) return; // Unknown order, ignore

    // Idempotent
    if (order.payment_status === "success") return;

    await this.orderRepo.updatePaymentStatus(order.id, "success", {
      payment_id: razorpay_payment_id,
    });

    await this.couponRepo.markSold(order.coupon_id);
  }

  async failOrder(razorpay_order_id: string): Promise<void> {
    const order = await this.orderRepo.findByRazorpayOrderId(razorpay_order_id);
    if (!order || order.payment_status === "success") return;

    await this.orderRepo.updatePaymentStatus(order.id, "failed");
  }
}
