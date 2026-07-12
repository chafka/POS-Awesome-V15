import { useToastStore } from "../../stores/toastStore.js";
import fiscalPrinterService, { type FiscalServiceResult } from "../../services/fiscalPrinterService";
import { buildReceiptPayload } from "../../utils/fiscalPayload";
import api from "../../services/api";

declare const __: (_str: string, _args?: any[]) => string;

export function useFiscalPrinter() {
	const toastStore = useToastStore();

	function showResultToast(title: string, result: FiscalServiceResult) {
		if (result.ok) {
			toastStore.show({ title, color: "success" });
		} else {
			toastStore.show({
				title,
				detail: result.error || __("Fiscal printer error"),
				color: "error",
			});
		}
	}

	async function saveFiscalResult(invoiceDoc: any, result: FiscalServiceResult) {
		const doctype = invoiceDoc?.doctype;
		const name = invoiceDoc?.name;
		if (!doctype || !name) {
			return;
		}
		try {
			await api.call("posawesome.posawesome.api.fiscal.save_fiscal_result", {
				doctype,
				name,
				receipt_number: result.data?.receiptNumber || null,
				fiscal_date: result.data?.receiptDateTime || null,
				memory_number: result.data?.fiscalMemorySerialNumber || null,
				status: result.ok ? "Success" : "Failed",
				response_json: JSON.stringify(result.data || { error: result.error }),
			});
		} catch (error) {
			console.warn("Failed to persist fiscal result on invoice", error);
		}
	}

	async function printReceipt(invoiceDoc: any, posProfile: any) {
		let payload;
		try {
			payload = buildReceiptPayload(invoiceDoc, posProfile);
		} catch (error: any) {
			toastStore.show({
				title: __("Cannot print fiscal receipt"),
				detail: error?.message || String(error),
				color: "error",
			});
			return;
		}

		const result = await fiscalPrinterService.printReceipt(posProfile, payload);
		showResultToast(__("Fiscal Receipt"), result);
		await saveFiscalResult(invoiceDoc, result);
		return result;
	}

	async function printXReport(posProfile: any) {
		const result = await fiscalPrinterService.printXReport(posProfile);
		showResultToast(__("X Report"), result);
		return result;
	}

	async function printZReport(posProfile: any) {
		const result = await fiscalPrinterService.printZReport(posProfile);
		showResultToast(__("Z Report"), result);
		return result;
	}

	async function depositCash(posProfile: any, amount: number) {
		const result = await fiscalPrinterService.deposit(posProfile, amount);
		showResultToast(__("Cash In"), result);
		return result;
	}

	async function withdrawCash(posProfile: any, amount: number) {
		const result = await fiscalPrinterService.withdraw(posProfile, amount);
		showResultToast(__("Cash Out"), result);
		return result;
	}

	async function printDuplicate(posProfile: any) {
		const result = await fiscalPrinterService.printDuplicate(posProfile);
		showResultToast(__("Duplicate Receipt"), result);
		return result;
	}

	async function getCashAmount(posProfile: any) {
		const result = await fiscalPrinterService.getCashAmount(posProfile);
		if (result.ok) {
			toastStore.show({
				title: __("Current Cash Amount"),
				detail: String(result.data?.amount ?? ""),
				color: "info",
			});
		} else {
			showResultToast(__("Current Cash Amount"), result);
		}
		return result;
	}

	return {
		printReceipt,
		printXReport,
		printZReport,
		depositCash,
		withdrawCash,
		printDuplicate,
		getCashAmount,
	};
}
