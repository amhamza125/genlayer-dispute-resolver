# GenLayer Dispute Resolver v3

An on-chain dispute arbitration and escrow smart contract built for the GenLayer GenVM. This contract allows two parties to resolve disputes with authenticated participation, verifiable web-based evidence, and automated, enforceable staking settlements.

## 🔗 Key Features

*   **Strict Party Authentication:** Binds the dispute to the exact transaction sender addresses. Only the explicitly named counterparty (Party B) can respond to an opened dispute, preventing third-party interference.
*   **Verifiable Web Evidence (Oracle-less):** Both parties submit evidence via URLs. The contract utilizes GenLayer's `gl.nondet.web.render` to fetch the data directly on-chain without relying on centralized oracles.
*   **AI Consensus Arbitration:** The dispute is evaluated using GenLayer's LLM equivalence principle (`gl.eq_principle.prompt_comparative`). Multiple validators independently analyze the evidence and must reach a consensus on the winner before state is committed.
*   **Intelligent Fallbacks (New):** If evidence is identical, unreachable, or evenly matched, the AI consensus safely returns an `INCONCLUSIVE` verdict, unlocking a dual-refund.
*   **Enforceable Settlement & Timeouts (New):** Both parties must stake matching GEN tokens. If the counterparty abandons the dispute, strict ISO-8601 deadlines allow the initiator to reclaim their funds via default. 

## 🔄 Contract Workflow

1.  **Party A** calls `open_dispute(counterparty, question, governing_terms, claim_a, evidence_url)` and stakes GEN.
2.  **Party B** calls `respond_dispute(dispute_id, claim_b, evidence_url)` and stakes a strictly matching amount of GEN.
3.  **Anyone** calls `resolve_dispute(dispute_id)`. The GenLayer validators fetch the URLs, process the LLM prompt against the governing terms, and reach consensus.
4.  **The Winner(s)** calls `withdraw()` to claim the allocated staked pool.

## 🛠️ Technical Changelog (v3 Updates)

This version resolves the structural and edge-case errors from the previous submission:

1.  **FIXED:** Nondeterministic LLM hallucinations. Added explicit `question` and `governing_terms` to the input to strictly bind the AI's reasoning.
2.  **ADDED:** `INCONCLUSIVE` state logic. The AI can now safely reject a binary choice if evidence is insufficient, automatically triggering a refund to both parties.
3.  **ADDED:** Statutory Timeouts. Integrated `claim_non_response` using GenVM deterministic clocks and Python's `datetime` module to release locked stakes if a party ghosts the dispute (300-second window).
4.  **IMPROVED:** Replaced flexible stakes with hard-coded `msg.value` enforcement to prevent Party B from underfunding the arbitration pool.

## 🧪 Testing Workflow (GenLayer Studio)

To verify the "Happy Path" of this contract in GenLayer Studio, follow this deterministic multi-wallet path:

| Step | Action | Wallet | Parameters | Payable Value | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `deploy` | Any | N/A | N/A | Contract address generated. |
| 2 | `open_dispute` | A | `counterparty`: Wallet B address<br>`question`: "Did the dev deliver?"<br>`governing_terms`: "Must deliver code."<br>`claim_a`: "Nothing delivered."<br>`evidence_url`: https://... | 15 GEN | Transaction SUCCESS.<br>Returns `dispute_id: 1` |
| 3 | `respond_dispute` | B | `dispute_id`: 1<br>`claim_b`: "I delivered it."<br>`evidence_url`: https://... | 15 GEN | Transaction SUCCESS.<br>(Reverts if stake doesn't match 15 GEN). |
| 4 | `resolve_dispute` | Any | `dispute_id`: 1 | 0 GEN | Transaction SUCCESS. Status becomes `RESOLVED` or `INCONCLUSIVE`. |
| 5 | `get_dispute` | Any | `dispute_id`: 1 | N/A | Returns JSON with winner address and AI reasoning. |
| 6 | `withdraw` | Winner | N/A | 0 GEN | Transaction SUCCESS.<br>Winner's balance increases. |

> **Note on Edge Cases:** For comprehensive proof of execution regarding Stake Mismatches, Non-Response Timeouts, and Inconclusive Refunds, please refer to the `TEST_REPORT.md` file located in this repository.
> 
