# GenLayer Dispute Resolver v2

<p align="center">
  <img src="assets/logo.png" alt="GenLayer Dispute Resolver Logo" width="200px"/>
</p>

An on-chain dispute arbitration and escrow smart contract built for the GenLayer GenVM. This contract allows two parties to resolve disputes with authenticated participation, verifiable web-based evidence, and automated, enforceable staking settlements.

## Key Features

*   **Strict Party Authentication:** Binds the dispute to the exact transaction sender addresses. Only the explicitly named counterparty (Party B) can respond to an opened dispute, preventing third-party interference.
*   **Verifiable Web Evidence (Oracle-less):** Both parties submit evidence via URLs. The contract utilizes GenLayer's `gl.nondet.web.render` to fetch the data directly on-chain without relying on centralized oracles.
*   **AI Consensus Arbitration:** The dispute is evaluated using GenLayer's LLM equivalence principle (`gl.eq_principle.prompt_comparative`). Multiple validators independently analyze the evidence and must reach a consensus on the winner before state is committed.
*   **Enforceable Settlement:** Both parties must stake GEN tokens to participate. Upon resolution, the combined pot is allocated to the winner using a secure pull-payment withdrawal pattern.

## Contract Workflow

1.  **Party A** calls `open_dispute(counterparty_address, evidence_url)` and stakes GEN.
2.  **Party B** calls `respond_dispute(dispute_id, evidence_url)` and stakes a matching amount of GEN.
3.  **Anyone** calls `resolve_dispute(dispute_id)`. The GenLayer validators fetch the URLs, process the LLM prompt, and reach consensus on a winner.
4.  **The Winner** calls `withdraw()` to claim the combined staked pool.

## Technical Changelog (v2 Updates)

This version resolves the errors from the previous submission:

1.  **FIXED:** GenVM `TreeMap` persistent storage initialization errors. Mappings are no longer re-instantiated in `__init__`.
2.  **ADDED:** Pull-payment withdraw pattern with strict zero-balance checks to prevent double-spending exploits.
3.  **IMPROVED:** LLM Prompt comparative logic to enforce a strict JSON output format (`{"winner": "A or B", "explanation": "..."}`).

## Testing Workflow (GenLayer Studio)

To verify this contract in GenLayer Studio, follow this deterministic multi-wallet path:

| Step | Action | Wallet | Parameters | Payable Value | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `deploy` | Any | N/A | N/A | Contract address generated. |
| **2** | `open_dispute` | **A** | `counterparty`: Wallet B address<br/>`evidence_url`: https://en.wikipedia.org/wiki/Eiffel_Tower | 10 GEN | Transaction SUCCESS. Returns `dispute_id: 1`. |
| **3** | `respond_dispute`| **B** | `dispute_id`: 1<br/>`evidence_url`: https://en.wikipedia.org/wiki/Paris | 10 GEN | Transaction SUCCESS. (Reverts if called by Wallet A). |
| **4** | `resolve_dispute`| Any | `dispute_id`: 1 | 0 GEN | Transaction SUCCESS. Status becomes `RESOLVED`. |
| **5** | `get_dispute` | Any | `dispute_id`: 1 | N/A | Returns JSON with winner address and AI reasoning. |
| **6** | `withdraw` | **Winner**| N/A | 0 GEN | Transaction SUCCESS. Winner's balance increases. |
