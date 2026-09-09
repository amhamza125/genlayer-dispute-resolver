# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from dataclasses import dataclass
import json
from datetime import datetime

@allow_storage
@dataclass
class DisputeRecord:
    party_a: Address
    party_b: Address
    question: str
    governing_terms: str
    claim_a: str
    claim_b: str
    evidence_url_a: str
    evidence_url_b: str
    stake_a: bigint
    stake_b: bigint
    deadline: bigint
    status: str  # "AWAITING_RESPONSE" | "AWAITING_RESOLUTION" | "RESOLVED" | "INCONCLUSIVE" | "DEFAULT_A"
    winner: Address
    ruling_explanation: str


class DisputeResolver(gl.Contract):
    """
    On-chain dispute arbitration protocol with explicit proposition framing,
    evidence-to-terms binding, deadline enforcement, and inconclusive verdict refunds.
    """

    disputes: TreeMap[str, DisputeRecord]
    dispute_count: bigint
    withdrawable: TreeMap[Address, bigint]
    default_timeout_seconds: bigint

    def __init__(self, timeout_seconds: int = 300):  # Default: 300s (5 minutes)
        self.dispute_count = bigint(0)
        self.default_timeout_seconds = bigint(timeout_seconds)

    def _get_current_time(self) -> bigint:
        """Parses the deterministic GenVM clock into a Unix timestamp integer."""
        raw_dt = gl.message_raw["datetime"]
        return bigint(int(datetime.fromisoformat(raw_dt.replace("Z", "+00:00")).timestamp()))

    @gl.public.write.payable
    def open_dispute(
        self,
        counterparty: str,
        question: str,
        governing_terms: str,
        claim_a: str,
        evidence_url: str
    ) -> str:
        sender = gl.message.sender_address
        stake = gl.message.value

        if stake <= 0:
            raise gl.vm.UserError("Must stake a positive amount of GEN to open a dispute")
        if not question.strip():
            raise gl.vm.UserError("Dispute proposition/question cannot be empty")
        if not governing_terms.strip():
            raise gl.vm.UserError("Governing terms cannot be empty")
        if not claim_a.strip():
            raise gl.vm.UserError("Party A claim statement cannot be empty")
        if not evidence_url.strip():
            raise gl.vm.UserError("Evidence URL cannot be empty")

        self.dispute_count += 1
        dispute_id = str(self.dispute_count)
        
        current_time = self._get_current_time()

        self.disputes[dispute_id] = DisputeRecord(
            party_a=sender,
            party_b=Address(counterparty),
            question=question,
            governing_terms=governing_terms,
            claim_a=claim_a,
            claim_b="",
            evidence_url_a=evidence_url,
            evidence_url_b="",
            stake_a=stake,
            stake_b=bigint(0),
            deadline=current_time + self.default_timeout_seconds,
            status="AWAITING_RESPONSE",
            winner=Address("0x0000000000000000000000000000000000000000"),
            ruling_explanation="",
        )
        return dispute_id

    @gl.public.write.payable
    def respond_dispute(self, dispute_id: str, claim_b: str, evidence_url: str) -> None:
        if dispute_id not in self.disputes:
            raise gl.vm.UserError("Dispute not found")

        record = self.disputes[dispute_id]
        if record.status != "AWAITING_RESPONSE":
            raise gl.vm.UserError("Dispute is not awaiting a response")

        current_time = self._get_current_time()
        if current_time > record.deadline:
            raise gl.vm.UserError("Response window has expired")

        sender = gl.message.sender_address
        if sender != record.party_b:
            raise gl.vm.UserError("Unauthorized: Only the designated counterparty can respond")

        stake = gl.message.value
        if stake != record.stake_a:
            raise gl.vm.UserError(f"Stake mismatch: Must match exact required stake of {record.stake_a}")
        if not claim_b.strip():
            raise gl.vm.UserError("Party B claim statement cannot be empty")
        if not evidence_url.strip():
            raise gl.vm.UserError("Evidence URL cannot be empty")

        record.claim_b = claim_b
        record.evidence_url_b = evidence_url
        record.stake_b = stake
        record.status = "AWAITING_RESOLUTION"
        self.disputes[dispute_id] = record

    @gl.public.write
    def claim_non_response(self, dispute_id: str) -> None:
        if dispute_id not in self.disputes:
            raise gl.vm.UserError("Dispute not found")

        record = self.disputes[dispute_id]
        if record.status != "AWAITING_RESPONSE":
            raise gl.vm.UserError("Dispute is not in an expired response state")

        current_time = self._get_current_time()
        if current_time <= record.deadline:
            raise gl.vm.UserError("Response deadline has not yet passed")

        record.status = "DEFAULT_A"
        record.ruling_explanation = "Counterparty failed to respond before the statutory deadline."
        record.winner = record.party_a
        self.disputes[dispute_id] = record

        # Refund Party A
        current = self.withdrawable[record.party_a] if record.party_a in self.withdrawable else bigint(0)
        self.withdrawable[record.party_a] = current + record.stake_a

    @gl.public.write
    def resolve_dispute(self, dispute_id: str) -> None:
        if dispute_id not in self.disputes:
            raise gl.vm.UserError("Dispute not found")

        record = self.disputes[dispute_id]
        if record.status != "AWAITING_RESOLUTION":
            raise gl.vm.UserError("Dispute is not ready for resolution")

        question = record.question
        terms = record.governing_terms
        claim_a = record.claim_a
        claim_b = record.claim_b
        url_a = record.evidence_url_a
        url_b = record.evidence_url_b
        party_a = record.party_a
        party_b = record.party_b

        def judge():
            evidence_a = gl.nondet.web.render(url_a, mode="text")
            evidence_b = gl.nondet.web.render(url_b, mode="text")

            prompt = f"""
            You are an impartial decentralized arbitration magistrate.
            Adjudicate the following dispute strictly according to the proposition and governing terms.

            DISPUTE PROPOSITION:
            {question}

            GOVERNING TERMS / CONTRACT RULES:
            {terms}

            CLAIMANT (PARTY A):
            Claim: {claim_a}
            Evidence ({url_a}):
            {evidence_a}

            RESPONDENT (PARTY B):
            Claim: {claim_b}
            Evidence ({url_b}):
            {evidence_b}

            INSTRUCTIONS:
            1. Evaluate if either party's claim is demonstrably supported by their evidence under the governing terms.
            2. If one party clearly prevails, set "winner" to "A" or "B".
            3. If the evidence is insufficient, unreachable/error-laden, unverified, or balanced, set "winner" to "INCONCLUSIVE".
            
            Respond ONLY in valid JSON format:
            {{"winner": "A" | "B" | "INCONCLUSIVE", "explanation": "<reasoning>"}}
            """
            result = gl.nondet.exec_prompt(prompt, response_format="json")
            winner = str(result.get("winner", "")).strip().upper()
            explanation = str(result.get("explanation", "")).strip()

            if winner not in ("A", "B", "INCONCLUSIVE"):
                raise gl.vm.UserError(f"Model returned invalid decision: {winner!r}")
            if not explanation:
                raise gl.vm.UserError("Decision missing justification")

            return json.dumps({"winner": winner, "explanation": explanation}, sort_keys=True)

        agreed = gl.eq_principle.prompt_comparative(
            judge,
            principle=(
                "Validators must reach unanimous consensus on the winner classification: "
                "'A', 'B', or 'INCONCLUSIVE'. The wording of explanations may differ slightly."
            ),
        )

        data = json.loads(agreed)
        verdict = data["winner"]
        explanation = data["explanation"]

        if verdict == "INCONCLUSIVE":
            record.status = "INCONCLUSIVE"
            record.ruling_explanation = explanation

            cur_a = self.withdrawable[party_a] if party_a in self.withdrawable else bigint(0)
            self.withdrawable[party_a] = cur_a + record.stake_a

            cur_b = self.withdrawable[party_b] if party_b in self.withdrawable else bigint(0)
            self.withdrawable[party_b] = cur_b + record.stake_b

        else:
            winner_address = party_a if verdict == "A" else party_b
            total_pot = record.stake_a + record.stake_b

            record.status = "RESOLVED"
            record.winner = winner_address
            record.ruling_explanation = explanation

            cur_win = self.withdrawable[winner_address] if winner_address in self.withdrawable else bigint(0)
            self.withdrawable[winner_address] = cur_win + total_pot

        self.disputes[dispute_id] = record

    @gl.public.write
    def withdraw(self) -> None:
        sender = gl.message.sender_address
        amount = self.withdrawable[sender] if sender in self.withdrawable else bigint(0)
        if amount <= 0:
            raise gl.vm.UserError("Nothing to withdraw")

        self.withdrawable[sender] = bigint(0)
        recipient = gl.get_contract_at(sender)
        recipient.emit_transfer(value=amount)

    @gl.public.view
    def get_dispute(self, dispute_id: str) -> str:
        if dispute_id not in self.disputes:
            raise gl.vm.UserError("Dispute not found")
        record = self.disputes[dispute_id]
        return json.dumps({
            "party_a": str(record.party_a),
            "party_b": str(record.party_b),
            "question": record.question,
            "governing_terms": record.governing_terms,
            "claim_a": record.claim_a,
            "claim_b": record.claim_b,
            "evidence_url_a": record.evidence_url_a,
            "evidence_url_b": record.evidence_url_b,
            "stake_a": str(record.stake_a),
            "stake_b": str(record.stake_b),
            "deadline": str(record.deadline),
            "status": record.status,
            "winner": str(record.winner),
            "ruling_explanation": record.ruling_explanation,
        })

    @gl.public.view
    def get_withdrawable_balance(self, address: str) -> str:
        addr = Address(address)
        if addr not in self.withdrawable:
            return "0"
        return str(self.withdrawable[addr])
        
