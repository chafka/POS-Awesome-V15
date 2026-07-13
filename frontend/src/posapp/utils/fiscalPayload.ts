/**
 * Maps a POSAwesome invoice document into the ErpNet.FP Net.FP JSON payload
 * shapes documented at https://github.com/erpnet/ErpNet.FP/blob/master/PROTOCOL.md
 */

const PAYMENT_TYPE_BY_MODE_KEYWORD: Array<[string, string]> = [
	["card", "card"],
	["bank", "bank"],
	["check", "check"],
	["cheque", "check"],
	["coupon", "coupons"],
];

/**
 * TODO: replace with the exact UJP-mandated uniqueSaleNumber format once
 * confirmed against the real PF700 (North Macedonia fiscal rules were not
 * available at implementation time). Currently just printer id + invoice name,
 * which is unique but not necessarily the government-mandated format.
 */
export function buildUniqueSaleNumber(invoiceDoc: any, printerId: string): string {
	return `${printerId}-${invoiceDoc?.name || "UNKNOWN"}`;
}

/**
 * North Macedonia UJP fiscal tax groups - fixed by law, not configurable:
 * А = 18%, Б = 5%, В = 10%, Г = 0% / Exempt.
 */
const MK_FISCAL_TAX_GROUP_BY_RATE: Array<[number, number]> = [
	[18, 1], // А
	[5, 2], // Б
	[10, 3], // В
	[0, 4], // Г (Exempt)
];

/**
 * Looks up the fiscal tax group (1-4) for a given VAT rate.
 * Throws if the rate doesn't match one of the four legal groups - a fiscal
 * receipt with the wrong tax group is a compliance problem, so this must
 * not fail silently.
 */
export function mapFiscalTaxGroup(rate: number): number {
	const match = MK_FISCAL_TAX_GROUP_BY_RATE.find(([groupRate]) => Math.abs(groupRate - rate) < 0.01);
	if (!match) {
		throw new Error(`No fiscal tax group for VAT rate ${rate}%. Expected 18%, 10%, 5%, or 0%/Exempt.`);
	}
	return match[1];
}

/** Sums the percentages in an item's `item_tax_rate` JSON (standard ERPNext field), or 0. */
function getItemVatRate(item: Record<string, any>): number {
	if (!item?.item_tax_rate) {
		return 0;
	}
	try {
		const parsed =
			typeof item.item_tax_rate === "string" ? JSON.parse(item.item_tax_rate) : item.item_tax_rate;
		return Object.values(parsed || {}).reduce((sum: number, rate: any) => sum + Number(rate || 0), 0);
	} catch {
		return 0;
	}
}

function mapPaymentType(modeOfPayment: string): string {
	const mode = String(modeOfPayment || "").toLowerCase();
	const found = PAYMENT_TYPE_BY_MODE_KEYWORD.find(([keyword]) => mode.includes(keyword));
	return found ? found[1] : "cash";
}

export interface FiscalReceiptPayload {
	uniqueSaleNumber: string;
	items: Array<Record<string, any>>;
	payments: Array<Record<string, any>>;
}

/** Builds the POST /printers/{id}/receipt body from a submitted invoice document. */
export function buildReceiptPayload(invoiceDoc: any, posProfile: any): FiscalReceiptPayload {
	const printerId = String(posProfile?.posa_fiscal_printer_id || "").trim();

	const items = (invoiceDoc?.items || []).map((item: any) => {
		const rate = getItemVatRate(item);
		return {
			text: item.item_name || item.item_code,
			quantity: Number(item.qty || 1),
			unitPrice: Number(item.rate || 0),
			taxGroup: mapFiscalTaxGroup(rate),
		};
	});

	const payments = (invoiceDoc?.payments || [])
		.filter((payment: any) => Number(payment.amount || 0) !== 0)
		.map((payment: any) => ({
			amount: Math.abs(Number(payment.amount || 0)),
			paymentType: mapPaymentType(payment.mode_of_payment),
		}));

	return {
		uniqueSaleNumber: buildUniqueSaleNumber(invoiceDoc, printerId),
		items,
		payments,
	};
}
