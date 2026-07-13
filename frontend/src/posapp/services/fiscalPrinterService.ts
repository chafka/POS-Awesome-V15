/**
 * Thin client for the local ErpNet.FP print server (Net.FP protocol).
 *
 * ErpNet.FP runs on the cashier's own machine (default `http://localhost:8001`)
 * and bridges the browser to the physical fiscal printer (e.g. a Synergy PF700).
 * The cloud-hosted ERPNext instance cannot reach it directly, so every call
 * here is a plain same-machine `fetch` from the browser - see
 * https://github.com/erpnet/ErpNet.FP/blob/master/PROTOCOL.md
 */

const DEFAULT_TIMEOUT_MS = 8000;

export interface FiscalPrinterConfig {
	baseUrl: string;
	printerId: string;
}

export interface FiscalServiceResult<T = any> {
	ok: boolean;
	data: T | null;
	error: string | null;
}

function resolveConfig(posProfile: any): FiscalPrinterConfig | null {
	const baseUrl = String(posProfile?.posa_fiscal_printer_url || "").trim();
	const printerId = String(posProfile?.posa_fiscal_printer_id || "").trim();
	if (!baseUrl || !printerId) {
		return null;
	}
	return { baseUrl: baseUrl.replace(/\/+$/, ""), printerId };
}

async function requestOnce(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(url, { ...init, signal: controller.signal });
	} finally {
		clearTimeout(timer);
	}
}

/** Fetch with one automatic retry on network/timeout failure (not on HTTP error responses). */
async function requestWithRetry(
	url: string,
	init: RequestInit,
	timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<FiscalServiceResult> {
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const response = await requestOnce(url, init, timeoutMs);
			let data: any = null;
			try {
				data = await response.json();
			} catch {
				data = null;
			}
			if (!response.ok) {
				return {
					ok: false,
					data,
					error: data?.messages?.[0]?.text || `HTTP ${response.status}`,
				};
			}
			return { ok: data?.ok === undefined || data?.ok === "true" || data?.ok === true, data, error: null };
		} catch (error: any) {
			if (attempt === 1) {
				return {
					ok: false,
					data: null,
					error: error?.name === "AbortError" ? "Fiscal printer request timed out" : String(error?.message || error),
				};
			}
			// fall through and retry once
		}
	}
	return { ok: false, data: null, error: "Unknown fiscal printer error" };
}

function endpoint(config: FiscalPrinterConfig, path: string) {
	return `${config.baseUrl}/printers/${encodeURIComponent(config.printerId)}/${path}`;
}

function postJson(config: FiscalPrinterConfig, path: string, body?: Record<string, any>) {
	return requestWithRetry(endpoint(config, path), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body || {}),
	});
}

const NOT_CONFIGURED: FiscalServiceResult = {
	ok: false,
	data: null,
	error: "Fiscal printer not configured",
};

/** Resolves the printer config from posProfile, or short-circuits with NOT_CONFIGURED. */
function withConfig(
	posProfile: any,
	run: (_config: FiscalPrinterConfig) => Promise<FiscalServiceResult>,
): Promise<FiscalServiceResult> {
	const config = resolveConfig(posProfile);
	if (!config) return Promise.resolve(NOT_CONFIGURED);
	return run(config);
}

const fiscalPrinterService = {
	resolveConfig,

	getStatus(posProfile: any) {
		return withConfig(posProfile, (config) => requestWithRetry(endpoint(config, "status"), { method: "GET" }));
	},

	printReceipt(posProfile: any, payload: Record<string, any>) {
		return withConfig(posProfile, (config) => postJson(config, "receipt", payload));
	},

	printXReport(posProfile: any) {
		return withConfig(posProfile, (config) => postJson(config, "xreport"));
	},

	printZReport(posProfile: any) {
		return withConfig(posProfile, (config) => postJson(config, "zreport"));
	},

	deposit(posProfile: any, amount: number) {
		return withConfig(posProfile, (config) => postJson(config, "deposit", { amount }));
	},

	withdraw(posProfile: any, amount: number) {
		return withConfig(posProfile, (config) => postJson(config, "withdraw", { amount }));
	},

	printDuplicate(posProfile: any) {
		return withConfig(posProfile, (config) => postJson(config, "duplicate"));
	},

	/** startDate/endDate are "YYYY-MM-DD" strings. Not all fiscal printers support this. */
	printPeriodicReport(posProfile: any, startDate: string, endDate: string) {
		return withConfig(posProfile, (config) =>
			postJson(config, "periodicreport", { startDate, endDate }),
		);
	},

	getCashAmount(posProfile: any) {
		return withConfig(posProfile, (config) => requestWithRetry(endpoint(config, "cash"), { method: "GET" }));
	},
};

export default fiscalPrinterService;
