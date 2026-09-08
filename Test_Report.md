# Security & State Transition Testing Report
**Protocol:** GenLayer Dispute Resolver v3
**Objective:** Verify resolution of v2 audit feedback (Inconclusive handling, timeouts, unmatched stakes).
**Environment:** GenLayer Studio (Testnet)

---

## Test 1: Inconclusive Verdict & Dual Refund
**Scenario:** Both parties submit identical placeholder evidence. The AI must reject a binary choice, declare the result inconclusive, and refund both stakes.
* **Action:** 
  * Party A opens dispute (ID 1) with 15 GEN.
  * Party B responds with 15 GEN.
  * Call `resolve_dispute(1)`.
* **State Transition Verified:** `status` successfully updated to `INCONCLUSIVE`.
* **AI Consensus Justification:**
  > "Both parties submitted identical placeholder evidence from example.com... Neither claim is substantiated by the provided evidence. The governing terms require delivery of a functional React codebase... Without credible, distinguishable evidence from either side, no determination can be made."
* **Fund Security Verified:** `get_withdrawable_balance` returned `15000000000000000000` (15 GEN) for both parties, proving safe dual-refund logic.
* **Evidence Link:** [See Studio Output Screenshot](test1_inconclusive.jpg)

---

## Test 2: Non-Response Default (Timeout Reclaim)
**Scenario:** Party B fails to respond within the statutory deadline. Party A must be able to reclaim their locked stake.
* **Action:**
  * Party A opens dispute (ID 2) with 20 GEN. 
  * Wait for the 300-second `deadline` to expire. 
  * Party A calls `claim_non_response(2)`.
* **State Transition Verified:** `status` successfully updated to `DEFAULT_A`.
* **Fund Security Verified:** `get_withdrawable_balance` returned `35000000000000000000` (35 GEN). This correctly reflects Party A's cumulative balance: the 15 GEN safely refunded from Test 1, plus the 20 GEN successfully reclaimed from Test 2.
* **Evidence Link:** [See Timeout Claim Screenshot](test2_timeout.jpg)

---

## Test 3: Stake Mismatch Revert
**Scenario:** Party B attempts to enter the arbitration while risking less collateral than Party A.
* **Action:**
  * Party A opens dispute (ID 3) with 30 GEN.
  * Party B calls `respond_dispute(3)` with 10 GEN (underfunded).
* **State Transition Verified:** Transaction immediately reverted.
* **Error Trace:** `gl.vm.UserError: Stake mismatch: Must match exact required stake of 30000000000000000000`
* **Evidence Link:** [See Revert Trace Screenshot](test3_mismatch.jpg)

