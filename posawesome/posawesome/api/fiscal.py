import frappe
from frappe import _
from frappe.utils import now_datetime

ALLOWED_DOCTYPES = ("Sales Invoice", "POS Invoice")
ALLOWED_STATUSES = ("Not Sent", "Success", "Failed")


@frappe.whitelist()
def save_fiscal_result(
    doctype,
    name,
    receipt_number=None,
    fiscal_date=None,
    memory_number=None,
    status=None,
    response_json=None,
):
    """Persist the ErpNet.FP fiscal print result on an already-submitted invoice.

    The fiscal print itself happens entirely client-side (browser -> local
    ErpNet.FP print server -> printer); this endpoint only records the
    outcome so it is visible on the invoice afterwards.
    """
    if doctype not in ALLOWED_DOCTYPES:
        frappe.throw(_("Invalid doctype for fiscal result: {0}").format(doctype))

    if not frappe.db.exists(doctype, name):
        frappe.throw(_("{0} {1} does not exist").format(doctype, name))

    if not frappe.has_permission(doctype, "write", name):
        frappe.throw(_("Not permitted to update {0} {1}").format(doctype, name), frappe.PermissionError)

    if status and status not in ALLOWED_STATUSES:
        frappe.throw(_("Invalid fiscal status: {0}").format(status))

    values = {}
    if receipt_number is not None:
        values["posa_fiscal_receipt_number"] = receipt_number
    if fiscal_date is not None:
        values["posa_fiscal_date"] = fiscal_date
    if memory_number is not None:
        values["posa_fiscal_memory_number"] = memory_number
    if status is not None:
        values["posa_fiscal_status"] = status
    if response_json is not None:
        values["posa_fiscal_response_json"] = response_json

    if not values:
        return {"updated": False}

    values.setdefault("posa_fiscal_date", now_datetime())
    frappe.db.set_value(doctype, name, values, update_modified=False)

    return {"updated": True}
