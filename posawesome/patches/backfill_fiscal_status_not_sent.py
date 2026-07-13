import frappe
from frappe.utils import get_table_name


def execute():
    for doctype in ("Sales Invoice", "POS Invoice"):
        if not frappe.db.has_column(doctype, "posa_fiscal_status"):
            continue
        table = get_table_name(doctype, wrap_in_backticks=True)
        frappe.db.sql(
            f"UPDATE {table} SET posa_fiscal_status = 'Not Sent' "
            "WHERE posa_fiscal_status IS NULL OR posa_fiscal_status = ''"
        )
