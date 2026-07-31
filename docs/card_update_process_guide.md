# SecureBank Application: Comprehensive Guide for Changing Debit & Credit Card Numbers

**Document ID:** `DOC-CARD-2026-8891`  
**System Target:** SecureBank Mobile Banking App (v5.2+) & Core Admin Portal (v12.4)  
**Classification:** Operational Guide & System Test Specification  
**Last Updated:** July 31, 2026  

---

## 1. Overview & Objectives

This document provides an exhaustive, step-by-step guide for updating, reissuing, or changing Debit and Credit Card numbers within the **SecureBank** application ecosystem. It covers both the **Customer Self-Service Flow** (via the Mobile App) and the **Administrative Override Flow** (via the Admin Web Portal).

For RAG testing and validation purposes, specific original card numbers, replacement card numbers, employee IDs, and authorization tokens have been explicitly embedded throughout this guide.

---

## 2. System Card Data & Embedded Test Identifiers

Below is the authoritative ledger of embedded card numbers and system identifiers referenced in this operational manual:

| Field Description | Identifier / Embedded Value | Card Brand / Type | Expiry Date | Status / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Original Debit Card Number** | `4532-8901-2345-6789` | Visa Classic Debit | `08/28` | Primary active card prior to change |
| **Original Credit Card Number** | `5412-7512-3456-7890` | Mastercard Platinum | `11/29` | Primary active credit card prior to change |
| **New Replacement Debit Card** | `4916-2345-6789-0123` | Visa Signature Debit | `09/31` | Newly assigned card number |
| **New Replacement Credit Card**| `5200-8812-9934-1102` | Mastercard World Elite | `12/31` | Newly assigned credit card number |
| **Admin System Override ID** | `ADM-AUTH-99482-X7` | System Security Token | N/A | Required for admin manual re-linking |
| **Admin Employee ID** | `EMP-88341-SYSADMIN` | Senior Banking Officer | N/A | Authorized administrator ID |
| **Target Database Record ID** | `CRD-DB-45328901` | PostgreSQL Core Table | N/A | Primary Key in `user_cards` table |

---

## 3. Customer Step-by-Step Guide: Changing Card Number via Mobile App

Customers cannot directly edit individual digits of an existing card due to PCI-DSS compliance regulations. Instead, changing a card number is performed by issuing a **Replacement Card Number** for lost, damaged, compromised, or upgraded cards.

### Step 1: Log in & Open Security Settings
1. Open the **SecureBank Mobile App** on iOS or Android.
2. Authenticate using **Biometrics (Face ID / Fingerprint)** or enter your 6-digit App PIN.
3. Tap on the **Cards** tab from the bottom navigation bar.

### Step 2: Select the Target Card
1. Swipe left or right to locate the card you wish to change:
   - For Debit Card: Select card ending in **`6789`** (Original Number: `4532-8901-2345-6789`).
   - For Credit Card: Select card ending in **`7890`** (Original Number: `5412-7512-3456-7890`).
2. Tap on **Manage Card** underneath the card preview.

### Step 3: Initiate Card Replacement (Number Change)
1. Select **Replace Card / Change Card Number** from the management menu.
2. Select the reason for changing the card number:
   - *Stolen or Compromised* (Instantly blocks old number).
   - *Damaged Physical Card* (Keeps old number active for 48 hours during delivery).
   - *Security Refresh / Fraud Prevention* (Generates instant new card number).
3. Confirm the delivery address for the physical replacement card.

### Step 4: Identity Verification & 2FA
1. A 6-digit Security Verification Code will be sent via SMS to your registered mobile device.
2. Enter the code in the prompt.
3. Complete secondary 2FA approval via Authenticator App if enabled.

### Step 5: Instant Virtual Card Issuance
1. Once verified, the old card (`4532-8901-2345-6789`) is immediately marked as `REPLACED_INACTIVE`.
2. A new virtual card number **`4916-2345-6789-0123`** is automatically generated and updated in your digital wallet (Apple Pay / Google Pay).
3. The physical card with the new card number will arrive within 3 to 5 business days.

---

## 4. Administrator Step-by-Step Guide: Manual Card Number Change & System Override

When a customer contacts support or when a card migration occurs, an authorized administrator must manually re-link or change the card number in the SecureBank Core Admin Portal.

### Step 1: Admin Portal Login & Authentication
1. Access the secure admin console at: `https://admin.securebank.internal/cards/manage`.
2. Authenticate using Admin Employee Credentials:
   - **Employee ID:** `EMP-88341-SYSADMIN`
   - Role: *Senior System Administrator / Fraud Specialist*
3. Complete Hardware FIDO2 Security Key challenge.

### Step 2: Search and Locate Customer Account & Card
1. In the search box, input either the Customer Account Number or the original card number:
   - **Search Query:** `4532-8901-2345-6789` (Original Debit Card)
2. Locate the database record **`CRD-DB-45328901`**.
3. Verify current record status: `STATUS: ACTIVE`.

### Step 3: Trigger Administrative Number Modification
1. Click the **Action Dropdown** on record `CRD-DB-45328901` and select **"Manual Card Re-link & Number Update"**.
2. In the **New Primary Account Number (PAN)** field, enter the newly assigned original embedded number:
   - **New PAN:** `4916-2345-6789-0123` (for Debit Card change)
   - *OR* **New PAN:** `5200-8812-9934-1102` (for Credit Card change)
3. Set Expiration Date to `09/31` and enter CVV generation seed.

### Step 4: Apply System Override & Authorization Key
1. In the **Security Override Token** field, input the master authorization key:
   - **Authorization Token:** `ADM-AUTH-99482-X7`
2. Enter the change justification reason: `"Customer requested full card number replacement due to fraudulent activity attempt - Approved by EMP-88341-SYSADMIN"`.
3. Click **Execute Number Update**.

### Step 5: Database Propagation & Tokenization Sync
1. The Core Banking Service updates PostgreSQL table `user_cards`:
   ```sql
   UPDATE user_cards 
   SET card_number = '4916234567890123', 
       old_card_number = '4532890123456789', 
       status = 'ACTIVE', 
       updated_by = 'EMP-88341-SYSADMIN',
       override_token = 'ADM-AUTH-99482-X7'
   WHERE record_id = 'CRD-DB-45328901';
   ```
2. Tokenization Gateway syncs the new card payload with Visa Direct / Mastercard Send networks.
3. System sends an automated confirmation notification email to the customer.

---

## 5. Troubleshooting & Verification Scenarios for RAG Benchmark Testing

To test if your RAG system accurately retrieves factual details from this document, use the following test queries and expected answers:

### Test Case 1: Original vs New Card Retrieval
- **User Prompt:** *"What is the original debit card number and what is the new replacement card number?"*
- **Expected RAG Answer:** 
  - Original Debit Card Number: `4532-8901-2345-6789`
  - New Replacement Debit Card Number: `4916-2345-6789-0123`

### Test Case 2: Original Credit Card Details
- **User Prompt:** *"What is the original credit card number mentioned in the bank app guide?"*
- **Expected RAG Answer:** `5412-7512-3456-7890` (Mastercard Platinum, Expiry `11/29`).

### Test Case 3: Admin Authorization Key & Employee ID
- **User Prompt:** *"What admin override key and employee ID are needed to manually change the card number in the core portal?"*
- **Expected RAG Answer:** 
  - Admin System Override ID: `ADM-AUTH-99482-X7`
  - Admin Employee ID: `EMP-88341-SYSADMIN`

### Test Case 4: Database Table & Record ID
- **User Prompt:** *"Which SQL database table and record ID are updated when changing the card number?"*
- **Expected RAG Answer:** Table `user_cards` and Record ID `CRD-DB-45328901`.

---

## 6. Security & PCI-DSS Compliance Summary

- All card number updates require explicit 2FA at the customer level or hardware FIDO2 key verification at the administrator level.
- Audit logs retain previous card numbers (`4532-8901-2345-6789` and `5412-7512-3456-7890`) in encrypted format for 7 years for regulatory auditing.
