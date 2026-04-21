/**
 * GA4 Enhanced Ecommerce — canonical event payload builder.
 *
 * Single source of truth for every revenue-related event we push to
 * dataLayer. Keeps `currency`, `value`, `transaction_id`, and the `items[]`
 * array consistent across `view_item_list`, `view_item`, `begin_checkout`,
 * `add_payment_info`, `purchase`, and `refund`. Inconsistency between those
 * events (different `value` rounding, missing `items`, etc.) is what breaks
 * GA4's funnel reports in practice.
 *
 * @see https://developers.google.com/analytics/devguides/collection/ga4/ecommerce
 */

import { trackEvent } from "./analytics";

export type PoolType = "personal" | "corporate";

export type Currency = "USD" | "COP";

export interface PoolUpgradeItem {
  fromCapacity: number;
  toCapacity: number;
  poolType: PoolType;
  /** Unit price in MAJOR units (not cents). USD → dollars, COP → pesos. */
  price: number;
  currency: Currency;
}

export interface GA4Item {
  item_id: string;
  item_name: string;
  item_category: string;
  item_variant: string;
  price: number;
  quantity: number;
  currency: Currency;
}

/**
 * Build the canonical GA4 item payload for a pool-capacity upgrade.
 * `item_id` is stable across currencies so reports can aggregate by SKU.
 */
export function buildUpgradeItem(upgrade: PoolUpgradeItem): GA4Item {
  return {
    item_id: `pool_upgrade_${upgrade.poolType}_${upgrade.toCapacity}`,
    item_name: `Pool capacity upgrade to ${upgrade.toCapacity}`,
    item_category: "pool_capacity",
    item_variant: upgrade.poolType,
    price: roundMoney(upgrade.price),
    quantity: 1,
    currency: upgrade.currency,
  };
}

/**
 * Round to 2 decimals for USD / integer for COP — GA4 expects numeric
 * values, not strings, and mixing precisions across events causes
 * discrepancies in reports.
 */
function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

// ── Funnel events ─────────────────────────────────────────────────

export interface ViewItemListParams {
  listId: string;
  listName: string;
  items: GA4Item[];
}

export function trackViewItemList(params: ViewItemListParams): void {
  trackEvent("view_item_list", {
    item_list_id: params.listId,
    item_list_name: params.listName,
    items: params.items,
  });
}

export function trackViewItem(upgrade: PoolUpgradeItem): void {
  const item = buildUpgradeItem(upgrade);
  trackEvent("view_item", {
    currency: item.currency,
    value: item.price,
    items: [item],
  });
}

export function trackBeginCheckout(upgrade: PoolUpgradeItem): void {
  const item = buildUpgradeItem(upgrade);
  trackEvent("begin_checkout", {
    currency: item.currency,
    value: item.price,
    items: [item],
  });
}

export interface AddPaymentInfoParams {
  upgrade: PoolUpgradeItem;
  paymentType: string;
}

export function trackAddPaymentInfo(params: AddPaymentInfoParams): void {
  const item = buildUpgradeItem(params.upgrade);
  trackEvent("add_payment_info", {
    currency: item.currency,
    value: item.price,
    payment_type: params.paymentType,
    items: [item],
  });
}

export interface PurchaseParams {
  /**
   * Gateway-level unique identifier for this transaction. GA4 deduplicates
   * purchases by this ID — sending the same transaction_id twice is a
   * no-op, which is what lets us safely fire `purchase` from both the
   * browser (on approval) and the success-page poll without double-counting.
   */
  transactionId: string;
  affiliation: "Mercado Pago Colombia" | "Polar International";
  upgrade: PoolUpgradeItem;
  /** Optional tax and shipping, if ever relevant. Defaulted to 0. */
  tax?: number;
  shipping?: number;
  /** Optional coupon / promo code applied. */
  coupon?: string;
}

export function trackPurchase(params: PurchaseParams): void {
  const item = buildUpgradeItem(params.upgrade);
  trackEvent("purchase", {
    transaction_id: params.transactionId,
    affiliation: params.affiliation,
    currency: item.currency,
    value: item.price,
    tax: params.tax ?? 0,
    shipping: params.shipping ?? 0,
    coupon: params.coupon,
    items: [item],
  });
}

export interface RefundParams {
  transactionId: string;
  upgrade: PoolUpgradeItem;
  /** Partial refund amount if different from full upgrade price. */
  value?: number;
  reason?: string;
}

export function trackRefund(params: RefundParams): void {
  const item = buildUpgradeItem(params.upgrade);
  const value = params.value !== undefined ? roundMoney(params.value) : item.price;
  trackEvent("refund", {
    transaction_id: params.transactionId,
    currency: item.currency,
    value,
    reason: params.reason,
    items: [item],
  });
}
