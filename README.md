# ⚖️ GenLayer Dispute Resolver

[![GenLayer](https://img.shields.io/badge/Network-GenLayer-blue.svg)](https://genlayer.com/)
[![Language](https://img.shields.io/badge/Language-Python_GenVM-ffd43b.svg)]

**GenLayer Dispute Resolver** is an autonomous, on-chain arbitration protocol. It securely escrows GEN tokens from two parties and utilizes GenVM's decentralized AI validators to evaluate conflicting claims and external web evidence against user-defined governing terms. 

This repository was completely redesigned to meet GenLayer protocol specifications, featuring strict `u256` GenVM type safety, deterministic `strict_eq` consensus for JSON outputs, and native EOA `emit_transfer` withdrawal mechanics.

---

## 🔗 Live Deployment & Demo

You can view, import, and interact with the latest corrected build directly in GenLayer Studio:
* **Contract Address:** `0x3E669262Db812047a4c05Da184e7942150969c51`
* **Studio Link:** [Open in GenLayer Studio](https://studio.genlayer.com/?import-contract=0x3E669262Db812047a4c05Da184e7942150969c51)

---

## 🏗️ Core Architecture

* **Equivalence Principle Consensus (`strict_eq`):** Rather than using unpredictable fuzzy evaluation, the LLM forces structured JSON output (`response_format="json"`). Validators utilize `gl.eq_principle.strict_eq()` to require exact, byte-for-byte agreement on the sorted JSON string before a winner is declared.
* **Native EVM Withdrawals:** Implements the secure `_Recipient(...).emit_transfer()` EVM interface for EOA payouts, adhering to the Checks-Effects-Interactions (CEI) pattern to prevent reentrancy.
* **Time Mechanics:** Handles non-response defaults natively via GenVM's pinned `time.time()` block context.
* **Inconclusive Fallbacks:** If web evidence is unreachable, errors out, or is evenly matched, the AI gracefully defaults to `INCONCLUSIVE`, safely splitting and refunding the escrowed GEN back to both parties' withdrawable balances.

---

## 🚀 Deployment & Demo Instructions

To test the full lifecycle of a dispute using [GenLayer Studio](https://studio.genlayer.com/), follow this sequence:

| Step | Method | Wallet | Parameters | Value (`msg.value`) | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Deploy** | `deploy` | Any | `timeout_seconds`: `300` | `0` | Contract deployed successfully. |
| **2. Open Dispute** | `open_dispute` | Wallet A | `counterparty`: `<Wallet_B_Address>`<br>`question`: `"Does the evidence mention GenLayer?"`<br>`governing_terms`: `"Evidence must contain the keyword GenLayer."`<br>`claim_a`: `"The page does not contain GenLayer."`<br>`evidence_url`: `"https://example.com"` | `100` (wei) | Returns `0` (Dispute ID). Status: `AWAITING_RESPONSE`. |
| **3. Respond** | `respond_dispute` | Wallet B | `dispute_id`: `0`<br>`claim_b`: `"The page contains GenLayer."`<br>`evidence_url`: `"https://example.com"` | `100` (wei) | Status updates to `AWAITING_RESOLUTION`. |
| **4. Resolve** | `resolve_dispute` | Any | `dispute_id`: `0` | `0` | AI validators evaluate the URL. Party A wins. Status updates to `RESOLVED`. |
| **5. Read State** | `get_dispute` | Any | `dispute_id`: `0` | `0` | Returns JSON showing Wallet A as winner with explanation. |
| **6. Withdraw** | `withdraw` | Wallet A | None | `0` | 200 wei transferred to Wallet A via `emit_transfer`. |

---

## 🛡️ Security & Protocol Considerations

* **Web Fetching Safety:** `gl.nondet.web.render` calls are wrapped in `try...except` blocks and lengths are truncated. If an external URL fails or returns a massive payload, it will not crash the VM; it safely degrades the string to trigger an `INCONCLUSIVE` verdict.
* **Strict Type Safety:** Migrated all state variables to protocol-accurate `u256` integer casting, ensuring flawless GenVM compilation.
