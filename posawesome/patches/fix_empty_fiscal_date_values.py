import frappe
from frappe.utils import get_table_name


def execute():
    for doctype in ("Sales Invoice", "POS Invoice"):
        if not frappe.db.has_column(doctype, "posa_fiscal_date"):
            continue
        table = get_table_name(doctype, wrap_in_backticks=True)
        # Comparing a datetime column directly against '' fails under strict SQL
        # mode (the same failure this patch is fixing), so compare as a string.
        frappe.db.sql(
            f"UPDATE {table} SET posa_fiscal_date = NULL WHERE CAST(posa_fiscal_date AS CHAR) = ''"
        )
