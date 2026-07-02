"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Confetti } from "@/components/confetti";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowLeft, ShieldCheck } from "lucide-react";

interface RevealedCoupon {
  order_id: string;
  coupon_id: string;
  coupon_code: string;
  brand_name: string;
  title: string;
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const coupon_id = searchParams.get("coupon_id");

  const [revealed, setRevealed] = useState<RevealedCoupon | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (!coupon_id) {
      // Schedule state updates after the current render
      Promise.resolve().then(() => {
        setError("Missing coupon information");
        setLoading(false);
      });
      return;
    }

    const reveal = async () => {
      try {
        const res = await fetch("/api/reveal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coupon_id }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Failed to reveal coupon");
        }

        const data: RevealedCoupon = await res.json();
        setRevealed(data);
        setShowConfetti(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    reveal();
  }, [coupon_id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 font-medium">Verifying your payment…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-center max-w-md">
          <p className="font-semibold mb-1">Unable to reveal coupon</p>
          <p className="text-sm">{error}</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          <ArrowLeft className="w-4 h-4" />
          Go to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <>
      <Confetti trigger={showConfetti} />
      <div className="max-w-lg mx-auto px-4 py-16 flex flex-col items-center gap-8">
        {/* Success badge */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mt-2">
            Payment Successful! 🎉
          </h1>
          <p className="text-gray-500">
            Your coupon code has been unlocked.
          </p>
        </div>

        {/* Coupon reveal card */}
        {revealed && (
          <div className="w-full bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 px-6 py-5 text-white">
              <p className="text-indigo-200 text-sm font-medium uppercase tracking-wide">
                {revealed.brand_name}
              </p>
              <h2 className="text-xl font-bold mt-0.5">{revealed.title}</h2>
            </div>

            <div className="px-6 py-6 flex flex-col items-center gap-4">
              <div className="w-full bg-gray-50 rounded-xl border-2 border-dashed border-indigo-200 px-6 py-4 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">
                  Your Coupon Code
                </p>
                <p className="font-mono text-2xl font-bold text-indigo-600 tracking-widest select-all">
                  {revealed.coupon_code}
                </p>
              </div>

              <CopyButton text={revealed.coupon_code} label="Copy Coupon Code" />
            </div>

            <div className="px-6 pb-6">
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
                <p className="font-semibold mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  How to use
                </p>
                <p>
                  Go to the {revealed.brand_name} app or website and apply this
                  code at checkout to claim your discount.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push("/")}>
            <ArrowLeft className="w-4 h-4" />
            Browse More
          </Button>
          <Button onClick={() => router.push("/dashboard")}>
            My Purchases
          </Button>
        </div>
      </div>
    </>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
