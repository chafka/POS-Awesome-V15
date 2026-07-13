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
function getItemTaxTemplateRate(item: Record<string, any>): number {
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

/** Sums the rate of the invoice's Sales Taxes and Charges rows - the overall invoice VAT rate. */
function getInvoiceTaxRate(invoiceDoc: any): number {
	const taxes = Array.isArray(invoiceDoc?.taxes) ? invoiceDoc.taxes : [];
	return taxes.reduce((sum: number, tax: any) => sum + Number(tax?.rate || 0), 0);
}

/**
 * Effective VAT rate for an item: prefers a per-item tax template rate, and
 * falls back to the invoice-level tax rate when the item has none set (common
 * when a single flat-rate tax template is applied at invoice level rather
 * than per item).
 */
function getItemVatRate(item: Record<string, any>, invoiceTaxRate: number): number {
	const itemRate = getItemTaxTemplateRate(item);
	return itemRate > 0 ? itemRate : invoiceTaxRate;
}

function mapPaymentType(modeOfPayment: string): string {
	const mode = String(modeOfPayment || "").toLowerCase();
	const found = PAYMENT_TYPE_BY_MODE_KEYWORD.find(([keyword]) => mode.includes(keyword));
	return found ? found[1] : "cash";
}

export interface FiscalReceiptPayload {
	items: Array<Record<string, any>>;
	payments: Array<Record<string, any>>;
}

/**
 * Builds the POST /printers/{id}/receipt body from a submitted invoice document.
 * uniqueSaleNumber is intentionally omitted - not required for North Macedonia.
 */
export function buildReceiptPayload(invoiceDoc: any, _posProfile: any): FiscalReceiptPayload {
	const invoiceTaxRate = getInvoiceTaxRate(invoiceDoc);

	const items = (invoiceDoc?.items || []).map((item: any) => {
		const rate = getItemVatRate(item, invoiceTaxRate);
		const netUnitPrice = Number(item.rate || 0);
		// The fiscal printer expects the tax-inclusive (final retail) price,
		// so the sum of item totals matches the tax-inclusive payment total.
		const grossUnitPrice = Math.round(netUnitPrice * (1 + rate / 100) * 100) / 100;
		return {
			text: item.item_name || item.item_code,
			quantity: Number(item.qty || 1),
			unitPrice: grossUnitPrice,
			taxGroup: mapFiscalTaxGroup(rate),
		};
	});

	// Sign is preserved (not Math.abs'd): a return invoice's items total is
	// negative, and the fiscal printer requires the payment total to match it
	// exactly, so a return's payment amount must be negative too.
	const payments = (invoiceDoc?.payments || [])
		.filter((payment: any) => Number(payment.amount || 0) !== 0)
		.map((payment: any) => ({
			amount: Number(payment.amount || 0),
			paymentType: mapPaymentType(payment.mode_of_payment),
		}));

	return {
		items,
		payments,
	};
}
