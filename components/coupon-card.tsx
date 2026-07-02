"use client";

import { PublicCoupon } from "@/types";
import { formatCurrency, formatDate, isExpired } from "@/lib/utils";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, Calendar, Tag } from "lucide-react";

interface CouponCardProps {
  coupon: PublicCoupon;
  onViewDetails: (coupon: PublicCoupon) => void;
}

export function CouponCard({ coupon, onViewDetails }: CouponCardProps) {
  const expired = isExpired(coupon.expiry_date);
  const sold = coupon.status === "sold";

  return (
    <Card className="hover:shadow-md transition-shadow duration-200 flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge variant={sold ? "warning" : expired ? "danger" : "default"}>
                {sold ? "Sold" : expired ? "Expired" : coupon.category}
              </Badge>
              {!sold && !expired && (
                <Badge variant="success">Available</Badge>
              )}
            </div>
            <h3 className="font-bold text-gray-900 text-base leading-snug line-clamp-2">
              {coupon.title}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5 font-medium">
              {coupon.brand_name}
            </p>
          </div>
          <div className="shrink-0 w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-lg uppercase select-none">
            {coupon.brand_name.slice(0, 2)}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1">
        {/* Locked coupon code display */}
        <div className="relative rounded-xl bg-gray-50 border border-dashed border-gray-200 px-4 py-3 flex items-center gap-3 mb-3">
          <Lock className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="font-mono text-lg font-bold text-gray-300 tracking-widest select-none">
            {coupon.masked_code}
          </span>
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] rounded-xl flex items-center justify-center">
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
              Pay {formatCurrency(coupon.price)} to unlock
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Calendar className="w-3.5 h-3.5" />
          <span>
            {expired ? "Expired" : "Valid till"} {formatDate(coupon.expiry_date)}
          </span>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 text-indigo-600">
          <Tag className="w-4 h-4" />
          <span className="font-bold text-lg">{formatCurrency(coupon.price)}</span>
        </div>
        <Button
          size="sm"
          variant={sold || expired ? "ghost" : "primary"}
          disabled={sold || expired}
          onClick={() => onViewDetails(coupon)}
        >
          {sold ? "Sold Out" : expired ? "Expired" : "View Details"}
        </Button>
      </CardFooter>
    </Card>
  );
}
