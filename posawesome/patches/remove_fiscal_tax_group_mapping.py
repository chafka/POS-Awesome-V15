import frappe


def execute():
    custom_field_name = "POS Profile-posa_fiscal_tax_group_mapping"
    if frappe.db.exists("Custom Field", custom_field_name):
        frappe.delete_doc("Custom Field", custom_field_name, ignore_permissions=True, force=True)

    if frappe.db.exists("DocType", "POS Fiscal Tax Group Mapping"):
        frappe.delete_doc("DocType", "POS Fiscal Tax Group Mapping", ignore_permissions=True, force=True)

    frappe.clear_cache(doctype="POS Profile")
