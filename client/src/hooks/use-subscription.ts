import { useQuery } from "@tanstack/react-query";

export type SubscriptionPlan = "free" | "standard" | "unlimited";

export interface SubscriptionStatus {
  plan: SubscriptionPlan;
  proformaLimit: number;
  proformaCount: number;
  isUnlimited: boolean;
  isStandardOrAbove: boolean;
}

export function useSubscription() {
  const { data, isLoading } = useQuery<{
    plan: string;
    proformaLimit: number;
    proformaCount: number;
  }>({
    queryKey: ["/api/payment/status"],
    staleTime: 5 * 60 * 1000,
  });

  const plan = (data?.plan || "free") as SubscriptionPlan;

  const status: SubscriptionStatus = {
    plan,
    proformaLimit: data?.proformaLimit ?? 1,
    proformaCount: data?.proformaCount ?? 0,
    isUnlimited: plan === "unlimited",
    isStandardOrAbove: plan === "standard" || plan === "unlimited",
  };

  return { status, isLoading };
}

export function canAccess(plan: SubscriptionPlan, requiredPlan: SubscriptionPlan): boolean {
  const hierarchy: Record<SubscriptionPlan, number> = {
    free: 0,
    standard: 1,
    unlimited: 2,
  };
  return hierarchy[plan] >= hierarchy[requiredPlan];
}
