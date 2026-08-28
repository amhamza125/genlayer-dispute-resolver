# AI Dispute Resolver — GenLayer Intelligent Contract

An on-chain dispute arbitrator built on GenLayer. Two parties submit conflicting claims, and the Intelligent Contract itself — not a human, not an oracle — reads both sides and issues a ruling using an LLM, with the result reaching consensus across independent validators running different models.

This is a small, working example of GenLayer's "Court of the Internet" vision: subjective, natural-language disputes resolved autonomously on-chain.

## How it works

1. A user calls `submit_dispute(claim_a, claim_b)` with each party's side of the story.
2. The contract builds a prompt asking an LLM to act as an impartial arbitrator and decide a winner with a brief reason.
3. The result is checked via GenLayer's `prompt_comparative` equivalence principle — validators just need to agree on the **substance** of the ruling (who won), not the exact wording, since LLM phrasing naturally varies between runs.
4. Once validators reach consensus, the ruling is stored on-chain and can be read back at any time.

## Contract

- **File:** `dispute_resolver_final.py`
- **Deployed at (testnet):** `0xD58d78290D5cfBe1288404C129CA4E53A92D90F9`
- **Explorer:** https://explorer-studio.genlayer.com/tx/0x880691da46e7441a1ab0f4314d05239ea12c857672df57843961bf32fb123794

## Methods

| Method | Type | Description |
|---|---|---|
| `submit_dispute(claim_a: str, claim_b: str)` | write | Submits a new dispute for AI arbitration |
| `get_ruling(dispute_id: int) -> str` | view | Returns the stored ruling (JSON: winner + reason) for a given dispute |
| `get_dispute_count() -> int` | view | Returns the total number of disputes submitted |

## Example

```
submit_dispute(
  "I paid the deposit on time via bank transfer",
  "The deposit was never received"
)

get_ruling(0)
# -> {"reason": "...", "winner": "A"}
```

## Why GenLayer

Traditional smart contracts can't read prose or judge intent — they need oracles or rigid pre-coded rules. This contract calls an LLM directly on-chain via `gl.nondet.exec_prompt`, and a randomly selected, diverse set of validators independently verifies the reasoning holds up — no oracle, no human arbitrator, no single point of failure.

## Built with

- GenLayer Studio
- Python (GenVM SDK)
- 
