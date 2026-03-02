import { API_ENDPOINTS } from "../config/api";
import { apiRequest } from "./apiClient";

export type PricingPlan = {
  id?: string | number;
  name: string;
  price: number;
  description: string;
  features: string[];
  popular?: boolean;
  cta?: string;
};

type ApiFeature = { featureName?: string };
type ApiPlan = {
  id?: string | number;
  name?: string;
  price?: number;
  description?: string;
  features?: ApiFeature[];
};
type PricingResponse =
  | ApiPlan[]
  | { data?: ApiPlan[]; items?: ApiPlan[]; plans?: ApiPlan[] };

export async function getPricingPlans(): Promise<PricingPlan[]> {
  const payload = await apiRequest<PricingResponse>(API_ENDPOINTS.pricing.list, {
    requiresAuth: true,
  });

  const plans = Array.isArray(payload)
    ? payload
    : payload.data ?? payload.items ?? payload.plans ?? [];

  return plans.map((plan) => ({
    id: plan.id,
    name: plan.name ?? "Plan",
    price: Number(plan.price ?? 0),
    description: plan.description ?? "",
    features: (plan.features ?? [])
      .map((feature) => feature.featureName ?? "")
      .filter(Boolean),
    popular: (plan.name ?? "").toLowerCase() === "premium",
    cta:
      (plan.name ?? "").toLowerCase() === "premium"
        ? "Start Free Trial"
        : (plan.name ?? "").toLowerCase() === "executive"
          ? "Contact Sales"
          : "Get Started",
  }));
}
