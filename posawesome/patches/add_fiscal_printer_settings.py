import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_field


FIELDS_BY_DOCTYPE = {
    "POS Profile": [
        {
            "fieldname": "posa_section_fiscal_printer",
            "label": "Fiscal Printer",
            "fieldtype": "Section Break",
            "collapsible": 1,
            "insert_after": "custom_allow_create_quotation",
        },
        {
            "fieldname": "posa_enable_fiscal_printer",
            "label": "Enable Fiscal Printer",
            "fieldtype": "Check",
            "default": "0",
            "description": "Send sales to a local ErpNet.FP fiscal print server after payment.",
            "insert_after": "posa_section_fiscal_printer",
        },
        {
            "fieldname": "posa_fiscal_printer_url",
            "label": "Fiscal Printer Server URL",
            "fieldtype": "Data",
            "default": "http://localhost:8001",
            "depends_on": "eval:doc.posa_enable_fiscal_printer==1",
            "description": "Base URL of the local ErpNet.FP print server (runs on the cashier's machine).",
            "insert_after": "posa_enable_fiscal_printer",
        },
        {
            "fieldname": "posa_fiscal_printer_id",
            "label": "Fiscal Printer ID",
            "fieldtype": "Data",
            "default": "pf700",
            "depends_on": "eval:doc.posa_enable_fiscal_printer==1",
            "description": "Printer id configured in ErpNet.FP (e.g. the 'pf700' key under Printers in its config).",
            "insert_after": "posa_fiscal_printer_url",
        },
    ],
    "Sales Invoice": [
        {
            "fieldname": "posa_fiscal_receipt_number",
            "label": "Fiscal Receipt Number",
            "fieldtype": "Data",
            "read_only": 1,
            "allow_on_submit": 1,
            "insert_after": "posa_delivery_date",
        },
        {
            "fieldname": "posa_fiscal_date",
            "label": "Fiscal Date",
            "fieldtype": "Datetime",
            "read_only": 1,
            "allow_on_submit": 1,
            "insert_after": "posa_fiscal_receipt_number",
        },
        {
            "fieldname": "posa_fiscal_memory_number",
            "label": "Fiscal Memory Number",
            "fieldtype": "Data",
            "read_only": 1,
            "allow_on_submit": 1,
            "insert_after": "posa_fiscal_date",
        },
        {
            "fieldname": "posa_fiscal_status",
            "label": "Fiscal Status",
            "fieldtype": "Select",
            "options": "\nNot Sent\nSuccess\nFailed",
            "read_only": 1,
            "allow_on_submit": 1,
            "insert_after": "posa_fiscal_memory_number",
        },
        {
            "fieldname": "posa_fiscal_response_json",
            "label": "Fiscal Response JSON",
            "fieldtype": "Long Text",
            "read_only": 1,
            "hidden": 1,
            "allow_on_submit": 1,
            "insert_after": "posa_fiscal_status",
        },
    ],
    "POS Invoice": [
        {
            "fieldname": "posa_fiscal_receipt_number",
            "label": "Fiscal Receipt Number",
            "fieldtype": "Data",
            "read_only": 1,
            "allow_on_submit": 1,
            "insert_after": "posa_delivery_date",
        },
        {
            "fieldname": "posa_fiscal_date",
            "label": "Fiscal Date",
            "fieldtype": "Datetime",
            "read_only": 1,
            "allow_on_submit": 1,
            "insert_after": "posa_fiscal_receipt_number",
        },
        {
            "fieldname": "posa_fiscal_memory_number",
            "label": "Fiscal Memory Number",
            "fieldtype": "Data",
            "read_only": 1,
            "allow_on_submit": 1,
            "insert_after": "posa_fiscal_date",
        },
        {
            "fieldname": "posa_fiscal_status",
            "label": "Fiscal Status",
            "fieldtype": "Select",
            "options": "\nNot Sent\nSuccess\nFailed",
            "read_only": 1,
            "allow_on_submit": 1,
            "insert_after": "posa_fiscal_memory_number",
        },
        {
            "fieldname": "posa_fiscal_response_json",
            "label": "Fiscal Response JSON",
            "fieldtype": "Long Text",
            "read_only": 1,
            "hidden": 1,
            "allow_on_submit": 1,
            "insert_after": "posa_fiscal_status",
        },
    ],
}


def _upsert_custom_field(doctype, field):
    custom_field_name = f"{doctype}-{field['fieldname']}"
    if not frappe.db.exists("Custom Field", custom_field_name):
        create_custom_field(doctype, field)
        return

    updates = {k: v for k, v in field.items() if k != "insert_after"}
    if updates:
        frappe.db.set_value(
            "Custom Field",
            custom_field_name,
            updates,
            update_modified=False,
        )

    insert_after = field.get("insert_after")
    if insert_after:
        frappe.db.set_value(
            "Custom Field",
            custom_field_name,
            "insert_after",
            insert_after,
            update_modified=False,
        )


def execute():
    for doctype, fields in FIELDS_BY_DOCTYPE.items():
        for field in fields:
            _upsert_custom_field(doctype, field)
        frappe.clear_cache(doctype=doctype)
