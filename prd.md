# Product Requirement Document (PRD)

## Project: Motor Insurance Search & Quotation System

---

# 1. Overview

## 1.1 Objective

The system is designed to provide a centralized platform for searching, comparing, and generating quotations for motor insurance plans from multiple insurance companies.

The primary goal is to:

* Reduce time spent searching insurance plans (from hours to seconds)
* Standardize data from multiple sources
* Improve accuracy and efficiency in quotation generation

---

## 1.2 Background

Currently, the process involves:

* Sending emails to multiple insurance companies
* Waiting for responses
* Manually comparing plans
* Re-entering data to generate quotations

Pain points:

* Time-consuming (1–3 hours per case)
* Inconsistent data format
* High manual effort
* Difficult to find best plan

---

## 1.3 Success Criteria

* Search response time < 2 seconds
* Reduce quotation preparation time by > 80%
* Support at least 5 insurance companies in Phase 1
* Allow users to compare up to 3 plans

---

# 2. Scope

## 2.1 In Scope (Phase 1)

* Search and filter insurance plans
* Compare insurance plans (1–3 items)
* Import insurance data from Excel/CSV
* Manual input for PDF-based data
* Data normalization and mapping
* Generate PDF quotation
* Role-based access control
* Basic reporting

---

## 2.2 Out of Scope (Phase 1)

* Full OCR automation
* AI-based recommendation engine
* External API integration
* Real-time pricing updates
* Mobile application

---

# 3. User Roles

| Role         | Permissions                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------- |
| Admin        | Full system access: all permissions below + user management (invite, deactivate, change roles)  |
| Manager      | All Senior Staff permissions + approve or reject imported data batches                          |
| Senior Staff | All Staff permissions + upload data files + manage vehicle model and plan type mappings         |
| Staff        | Search insurance plans, compare plans, generate quotation PDFs                                  |

---

# 4. Functional Requirements

---

## 4.1 Search Module

### Description

Allows users to search insurance plans based on vehicle and coverage criteria.

### Inputs

* Vehicle Make
* Vehicle Model
* Vehicle Year (Production Year)
* Insurance Plan Type (1, 2, 3, 2+, 3+)
* Repair Type (Garage / Dealer)
* Insurance Company (optional)
* Excess (optional filter)

### Business Logic

* Vehicle age = CurrentYear - ProductionYear + 1
* Match insurance plans based on:

  * Model mapping
  * Year range eligibility
* If no specific plan selected → return all available plans

### Outputs

* List of matching insurance plans
* Sort options:

  * Price (ascending) — **default**
  * Sum insured (descending)

---

## 4.2 Compare Module

### Description

Allows users to compare up to 3 insurance plans.

### Features

* Side-by-side comparison
* Highlight differences
* Show:

  * Premium
  * Sum insured
  * Coverage
  * Excess
  * Remarks

---

## 4.3 Quotation Module

### Description

Generate quotation document from selected plans.

### Features

* Select 1–3 plans
* Generate PDF (JasperReports)
* Include:

  * Company name
  * Plan details
  * Premium
  * Coverage
  * Remarks

---

## 4.4 Data Import Module

### Description

Handles ingestion of insurance data from multiple sources.

### Supported Formats

* Excel (Primary)
* CSV
* PDF (manual entry)

### Workflow

1. Upload file
2. Parse data
   * **On parse failure:** Reject the entire file. Display a structured error report (row number, column, error type). No rows are staged. Uploader must correct and re-upload.
3. Store in staging (only if parse fully succeeds)
4. Map fields and values
5. Validate data
6. Review
7. Approve
8. Publish to main system

---

## 4.5 Mapping Module

### Description

Standardizes data from different companies into a unified format.

### Features

* Vehicle model mapping
* Plan type mapping
* Auto-suggestion (basic matching)
* Manual override
* Approval workflow

### Edge Cases

* **Unmatched model:** If an imported vehicle model has no mapping entry, the record is staged with status "unmapped". The batch is blocked from publishing until all unmapped models are manually resolved via the Mapping Module.
* **Duplicate mapping:** (To be clarified — see Clarifications section)

---

## 4.6 Review & Approval Module

### Description

Ensures data quality before publishing.

### Features

* Review imported data
* Approve or reject
* Track approval history

---

## 4.7 Reporting Module

### Reports

* Quotation usage statistics
* Top vehicle brands/models
* Import errors
* Popular insurance plans

---

# 5. Data Requirements

## 5.1 Vehicle Data

* Make
* Model
* Sub-model
* Year

## 5.2 Insurance Data

* Company
* Plan Type
* Repair Type
* Sum Insured
* Premium (Total)
* Excess
* Coverage details
* Remarks

## 5.3 System Data

* Import batch
* Source file
* Mapping data
* Audit logs

---

# 6. Non-Functional Requirements

## 6.1 Performance

* Search response time < 2 seconds

## 6.2 Scalability

* Support up to 100 concurrent users
* Handle ~30,000 records per year

## 6.3 Security

* Role-based access control
* Audit logging
* User registration is invite-based: Admin creates the account and sends an invite link; the user sets their own password upon first login

## 6.4 Availability

* Target uptime: 99.5%

## 6.5 Backup

* Daily database backup

---

# 7. Data Management

## 7.1 Versioning

* Each import stored as a batch
* Records linked to batch ID

## 7.2 Traceability

* Track source file for each record

## 7.3 Rollback

* Soft rollback via batch deactivation

---

# 8. Assumptions

* Customer provides sample data files
* Initial companies ≤ 5
* File formats remain stable in Phase 1
* Manual mapping is acceptable

---

# 9. Constraints

* Data from insurance companies is not standardized
* PDF formats vary significantly
* Requires human validation

---

# 10. Future Enhancements (Phase 2)

* OCR automation with AI
* API integration with insurance providers
* Recommendation engine
* Advanced analytics dashboard

---

# 11. Technical Stack

* Frontend: Angular + Tailwind CSS
* Backend: .NET 10 Web API
* Database: PostgreSQL
* Reporting: JasperReports

---

# 12. Risks

| Risk                      | Mitigation                     |
| ------------------------- | ------------------------------ |
| Inconsistent data formats | Mapping module + manual review |
| OCR inaccuracies          | Human validation               |
| Model mismatch            | Mapping + fuzzy matching       |
| Scope creep               | Strict Phase definition        |

---

# 13. Summary

This system focuses on:

* Data normalization
* Fast search capability
* Efficient quotation generation

Phase 1 emphasizes usability and accuracy over automation.

---

# 14. Clarifications

### Session 2026-04-12

- Q: Is user registration open, admin-created, or invite-based? → A: Invite-based — Admin creates the account and sends an invite link; user sets their own password
- Q: What are the exact permissions per role? → A: Staff (search + quote), Senior Staff (+ upload + mapping), Manager (+ approve/reject imports), Admin (full access + user management)
- Q: What happens when file parsing fails during import? → A: Reject entire file, display structured error report (row/column/error type), require re-upload — no partial staging
- Q: How to handle an imported vehicle model not found in the mapping table? → A: Stage record as "unmapped"; block batch from publishing until manually resolved in Mapping Module
- Q: What is the default sort order for search results? → A: Price ascending (cheapest premium first)
