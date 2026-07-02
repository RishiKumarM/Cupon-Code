export type CouponStatus = "available" | "sold";
export type PaymentStatus = "pending" | "success" | "failed";

export interface Coupon {
  id: string;
  brand_name: string;
  category: string;
  title: string;
  expiry_date: string;
  terms_and_conditions: string[];
  price: number;
  coupon_code_encrypted: string; // server-only, never sent to client
  masked_code: string;
  status: CouponStatus;
  created_at: string;
  updated_at: string;
}

/** Safe coupon shape — no encrypted code, safe for public APIs */
export type PublicCoupon = Omit<Coupon, "coupon_code_encrypted">;

export interface Order {
  id: string;
  user_id: string;
  coupon_id: string;
  payment_id: string | null;
  razorpay_order_id: string;
  razorpay_signature: string | null;
  payment_status: PaymentStatus;
  amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface OrderWithCoupon extends Order {
  coupon: PublicCoupon;
}

export interface RevealedCoupon {
  order_id: string;
  coupon_id: string;
  coupon_code: string;
  brand_name: string;
  title: string;
}

export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
}

export interface CreateOrderInput {
  coupon_id: string;
}

export interface VerifyPaymentInput {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
