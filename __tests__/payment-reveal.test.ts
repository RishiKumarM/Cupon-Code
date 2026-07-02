/**
 * Tests for payment verification and reveal authorization logic.
 */

import crypto from "crypto";
import { verifyPaymentSignature } from "@/lib/razorpay.server";
import { encryptCode } from "@/lib/crypto.server";
import { OrderService } from "@/services/order.service";
import { PaymentService } from "@/services/payment.service";

// ─── Helpers ────────────────────────────────────────────────────────────────

const mockCoupon = {
  id: "coupon-uuid-1",
  brand_name: "ixigo",
  category: "Flights",
  title: "₹6000 off flights",
  expiry_date: "2099-12-31",
  terms_and_conditions: ["Valid on app"],
  price: 49,
  masked_code: "IXI****",
  status: "available" as const,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockCouponWithCode = {
  ...mockCoupon,
  coupon_code_encrypted: "", // set per-test
};

const mockOrder = {
  id: "order-uuid-1",
  user_id: "user-uuid-1",
  coupon_id: "coupon-uuid-1",
  payment_id: "pay_test123",
  razorpay_order_id: "order_test123",
  razorpay_signature: "sig_test",
  payment_status: "success" as const,
  amount: 49,
  currency: "INR",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ─── Payment Signature Verification Tests ────────────────────────────────────

describe("Payment Signature Verification", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("verifies a valid Razorpay payment signature", () => {
    process.env.RAZORPAY_KEY_SECRET = "test_secret_key";

    const body = "order_test123|pay_test456";
    const expected = crypto
      .createHmac("sha256", "test_secret_key")
      .update(body)
      .digest("hex");

    const result = verifyPaymentSignature("order_test123", "pay_test456", expected);
    expect(result).toBe(true);
  });

  it("rejects an invalid payment signature (same length, wrong value)", () => {
    process.env.RAZORPAY_KEY_SECRET = "test_secret_key";

    // 64 hex chars = 32 bytes, same length as SHA-256 output, but wrong value
    const wrongSig = "a".repeat(64);
    const result = verifyPaymentSignature("order_test123", "pay_test456", wrongSig);
    expect(result).toBe(false);
  });

  it("rejects a signature of wrong length", () => {
    process.env.RAZORPAY_KEY_SECRET = "test_secret_key";

    const result = verifyPaymentSignature("order_test123", "pay_test456", "tooshort");
    expect(result).toBe(false);
  });

  it("throws if RAZORPAY_KEY_SECRET is not set", () => {
    delete process.env.RAZORPAY_KEY_SECRET;

    expect(() =>
      verifyPaymentSignature("order_test", "pay_test", "sig_test")
    ).toThrow("RAZORPAY_KEY_SECRET");
  });
});

// ─── Reveal Authorization Tests ──────────────────────────────────────────────

describe("OrderService.revealCouponCode", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      ENCRYPTION_KEY: "super_secret_test_key_for_testing",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("reveals coupon code when user has a successful order", async () => {
    const encrypted = encryptCode("TESTCODE123");

    const mockOrderRepo = {
      findByUserAndCoupon: jest.fn().mockResolvedValue(mockOrder),
      findByUser: jest.fn(),
      findById: jest.fn(),
      findByRazorpayOrderId: jest.fn(),
      create: jest.fn(),
      updatePaymentStatus: jest.fn(),
    };

    const mockCouponRepo = {
      findByIdWithCode: jest
        .fn()
        .mockResolvedValue({ ...mockCouponWithCode, coupon_code_encrypted: encrypted }),
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      markSold: jest.fn(),
      getCategories: jest.fn(),
    };

    const service = new OrderService(mockOrderRepo as never, mockCouponRepo as never);
    const result = await service.revealCouponCode("user-uuid-1", "coupon-uuid-1");

    expect(result.coupon_code).toBe("TESTCODE123");
    expect(result.coupon_id).toBe("coupon-uuid-1");
    expect(result.brand_name).toBe("ixigo");
  });

  it("throws when user has no successful order for coupon", async () => {
    const mockOrderRepo = {
      findByUserAndCoupon: jest.fn().mockResolvedValue(null),
      findByUser: jest.fn(),
      findById: jest.fn(),
      findByRazorpayOrderId: jest.fn(),
      create: jest.fn(),
      updatePaymentStatus: jest.fn(),
    };

    const mockCouponRepo = {
      findByIdWithCode: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      markSold: jest.fn(),
      getCategories: jest.fn(),
    };

    const service = new OrderService(mockOrderRepo as never, mockCouponRepo as never);

    await expect(
      service.revealCouponCode("user-uuid-1", "coupon-uuid-1")
    ).rejects.toThrow("No successful purchase found");

    // Ensure coupon code was never fetched
    expect(mockCouponRepo.findByIdWithCode).not.toHaveBeenCalled();
  });

  it("throws when coupon does not exist", async () => {
    const mockOrderRepo = {
      findByUserAndCoupon: jest.fn().mockResolvedValue(mockOrder),
      findByUser: jest.fn(),
      findById: jest.fn(),
      findByRazorpayOrderId: jest.fn(),
      create: jest.fn(),
      updatePaymentStatus: jest.fn(),
    };

    const mockCouponRepo = {
      findByIdWithCode: jest.fn().mockResolvedValue(null),
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      markSold: jest.fn(),
      getCategories: jest.fn(),
    };

    const service = new OrderService(mockOrderRepo as never, mockCouponRepo as never);

    await expect(
      service.revealCouponCode("user-uuid-1", "coupon-uuid-1")
    ).rejects.toThrow("Coupon not found");
  });
});

// ─── PaymentService idempotency Tests ────────────────────────────────────────

describe("PaymentService.verifyAndFulfill", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, RAZORPAY_KEY_SECRET: "test_secret_key" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns false on invalid signature", async () => {
    const mockOrderRepo = {
      findByRazorpayOrderId: jest.fn(),
      findByUserAndCoupon: jest.fn(),
      findByUser: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updatePaymentStatus: jest.fn(),
    };
    const mockCouponRepo = {
      findById: jest.fn(),
      findByIdWithCode: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      markSold: jest.fn(),
      getCategories: jest.fn(),
    };

    const service = new PaymentService(mockOrderRepo as never, mockCouponRepo as never);
    const result = await service.verifyAndFulfill(
      "order_test",
      "pay_test",
      "a".repeat(64) // invalid hex signature
    );

    expect(result.success).toBe(false);
    expect(mockOrderRepo.updatePaymentStatus).not.toHaveBeenCalled();
  });

  it("is idempotent: does not update already-successful order", async () => {
    const body = "order_test|pay_test";
    const validSig = crypto
      .createHmac("sha256", "test_secret_key")
      .update(body)
      .digest("hex");

    const successfulOrder = { ...mockOrder, razorpay_order_id: "order_test" };

    const mockOrderRepo = {
      findByRazorpayOrderId: jest.fn().mockResolvedValue(successfulOrder),
      updatePaymentStatus: jest.fn(),
      findByUserAndCoupon: jest.fn(),
      findByUser: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };
    const mockCouponRepo = {
      markSold: jest.fn(),
      findById: jest.fn(),
      findByIdWithCode: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      getCategories: jest.fn(),
    };

    const service = new PaymentService(mockOrderRepo as never, mockCouponRepo as never);
    const result = await service.verifyAndFulfill("order_test", "pay_test", validSig);

    expect(result.success).toBe(true);
    // Should NOT update because already success
    expect(mockOrderRepo.updatePaymentStatus).not.toHaveBeenCalled();
    expect(mockCouponRepo.markSold).not.toHaveBeenCalled();
  });
});
