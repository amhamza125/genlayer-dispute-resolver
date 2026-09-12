# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from dataclasses import dataclass
import json
import time

@gl.evm.contract_interface
class _Recipient:
    class View:
        pass
    class Write:
        pass

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
    stake_a: u256
    stake_b: u256
    deadline: u256
    status: str
    winner: Address
    ruling_explanation: str


class DisputeResolver(gl.Contract):
    """
    On-chain dispute arbitration protocol with explicit proposition framing,
    evidence-to-terms binding, deadline enforcement, and inconclusive verdict refunds.
    """

    disputes: TreeMap[u256, DisputeRecord]
    dispute_count: u256
    withdrawable: TreeMap[Address, u256]
    default_timeout_seconds: u256

    def __init__(self, timeout_seconds: int = 300):  # Default: 300s (5 minutes)
        self.dispute_count = u256(0)
        self.default_timeout_seconds = u256(timeout_seconds)

    @gl.public.write.payable
    def open_dispute(
        self,
        counterparty: str,
        question: str,
        governing_terms: str,
        claim_a: str,
        evidence_url: str
    ) -> int:
        sender = gl.message.sender_address
        stake = gl.message.value

        if stake <= u256(0):
            raise gl.vm.UserError("Must stake a positive amount of GEN to open a dispute")
        if not question.strip():
            raise gl.vm.UserError("Dispute proposition/question cannot be empty")
        if not governing_terms.strip():
            raise gl.vm.UserError("Governing terms cannot be empty")
        if not claim_a.strip():
            raise gl.vm.UserError("Party A claim statement cannot be empty")
        if not evidence_url.strip():
            raise gl.vm.UserError("Evidence URL cannot be empty")
            
        try:
            party_b = Address(counterparty)
        except ValueError:
            raise gl.vm.UserError("Malformed counterparty address")

        dispute_id = self.dispute_count
        self.dispute_count += u256(1)
        
        current_time = u256(int(time.time()))

        self.disputes[dispute_id] = DisputeRecord(
            party_a=sender,
            party_b=party_b,
            question=question,
            governing_terms=governing_terms,
            claim_a=claim_a,
            claim_b="",
            evidence_url_a=evidence_url,
            evidence_url_b="",
            stake_a=stake,
            stake_b=u256(0),
            deadline=current_time + self.default_timeout_seconds,
            status="AWAITING_RESPONSE",
            winner=Address("0x0000000000000000000000000000000000000000"),
            ruling_explanation="",
        )
        return int(dispute_id)

    @gl.public.write.payable
    def respond_dispute(self, dispute_id: int, claim_b: str, evidence_url: str) -> None:
        jid = u256(dispute_id)
        if jid not in self.disputes:
            raise gl.vm.UserError("Dispute not found")

        record = self.disputes[jid]
        if record.status != "AWAITING_RESPONSE":
            raise gl.vm.UserError("Dispute is not awaiting a response")

        current_time = u256(int(time.time()))
        if current_time > record.deadline:
            raise gl.vm.UserError("Response window has expired")

        sender = gl.message.sender_address
        if sender != record.party_b:
            raise gl.vm.UserError("Unauthorized: Only the designated counterparty can respond")

        stake = gl.message.value
        if stake != record.stake_a:
            raise gl.vm.UserError(f"Stake mismatch: Must match exact required stake")
        if not claim_b.strip():
            raise gl.vm.UserError("Party B claim statement cannot be empty")
        if not evidence_url.strip():
            raise gl.vm.UserError("Evidence URL cannot be empty")

        record.claim_b = claim_b
        record.evidence_url_b = evidence_url
        record.stake_b = stake
        record.status = "AWAITING_RESOLUTION"
        self.disputes[jid] = record

    @gl.public.write
    def claim_non_response(self, dispute_id: int) -> None:
        jid = u256(dispute_id)
        if jid not in self.disputes:
            raise gl.vm.UserError("Dispute not found")

        record = self.disputes[jid]
        if record.status != "AWAITING_RESPONSE":
            raise gl.vm.UserError("Dispute is not in an expired response state")

        current_time = u256(int(time.time()))
        if current_time <= record.deadline:
            raise gl.vm.UserError("Response deadline has not yet passed")

        record.status = "DEFAULT_A"
        record.ruling_explanation = "Counterparty failed to respond before the statutory deadline."
        record.winner = record.party_a
        self.disputes[jid] = record

        # Refund Party A safely
        current = self.withdrawable.get(record.party_a, u256(0))
        self.withdrawable[record.party_a] = current + record.stake_a

    @gl.public.write
    def resolve_dispute(self, dispute_id: int) -> None:
        jid = u256(dispute_id)
        if jid not in self.disputes:
            raise gl.vm.UserError("Dispute not found")

        record = self.disputes[jid]
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

        def judge() -> str:
            # Secure web fetching with length truncation to prevent VM limits
            try:
                evidence_a = gl.nondet.web.render(url_a, mode="text")
                if len(evidence_a) > 20000: evidence_a = evidence_a[:20000]
            except Exception:
                evidence_a = "Error fetching evidence"
                
            try:
                evidence_b = gl.nondet.web.render(url_b, mode="text")
                if len(evidence_b) > 20000: evidence_b = evidence_b[:20000]
            except Exception:
                evidence_b = "Error fetching evidence"

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
            
            try:
                # Force structured JSON format
                result_str = gl.nondet.exec_prompt(prompt, response_format="json")
                result = json.loads(result_str)
                winner = str(result.get("winner", "INCONCLUSIVE")).strip().upper()
                explanation = str(result.get("explanation", "No reasoning provided.")).strip()
            except Exception:
                winner = "INCONCLUSIVE"
                explanation = "Model failed to return valid JSON."

            if winner not in ("A", "B", "INCONCLUSIVE"):
                winner = "INCONCLUSIVE"

            # Return a strictly sorted string so strict_eq can compare it byte-for-byte
            return json.dumps({"winner": winner, "explanation": explanation}, sort_keys=True)

        # Use strict_eq on the normalized JSON output to guarantee deterministic consensus
        agreed = gl.eq_principle.strict_eq(judge)

        try:
            data = json.loads(agreed)
            verdict = data.get("winner", "INCONCLUSIVE")
            explanation = data.get("explanation", "No explanation.")
        except Exception:
            verdict = "INCONCLUSIVE"
            explanation = "Consensus output parsing failed."

        if verdict == "INCONCLUSIVE":
            record.status = "INCONCLUSIVE"
            record.ruling_explanation = explanation

            cur_a = self.withdrawable.get(party_a, u256(0))
            self.withdrawable[party_a] = cur_a + record.stake_a

            cur_b = self.withdrawable.get(party_b, u256(0))
            self.withdrawable[party_b] = cur_b + record.stake_b

        else:
            winner_address = party_a if verdict == "A" else party_b
            total_pot = record.stake_a + record.stake_b

            record.status = "RESOLVED"
            record.winner = winner_address
            record.ruling_explanation = explanation

            cur_win = self.withdrawable.get(winner_address, u256(0))
            self.withdrawable[winner_address] = cur_win + total_pot

        self.disputes[jid] = record

    @gl.public.write
    def withdraw(self) -> None:
        sender = gl.message.sender_address
        amount = self.withdrawable.get(sender, u256(0))
        if amount <= u256(0):
            raise gl.vm.UserError("Nothing to withdraw")

        self.withdrawable[sender] = u256(0)
        _Recipient(sender).emit_transfer(value=amount)

    @gl.public.view
    def get_dispute(self, dispute_id: int) -> str:
        jid = u256(dispute_id)
        if jid not in self.disputes:
            raise gl.vm.UserError("Dispute not found")
        record = self.disputes[jid]
        return json.dumps({
            "party_a": str(record.party_a),
            "party_b": str(record.party_b),
            "question": record.question,
            "governing_terms": record.governing_terms,
            "claim_a": record.claim_a,
            "claim_b": record.claim_b,
            "evidence_url_a": record.evidence_url_a,
            "evidence_url_b": record.evidence_url_b,
            "stake_a": int(record.stake_a),
            "stake_b": int(record.stake_b),
            "deadline": int(record.deadline),
            "status": record.status,
            "winner": str(record.winner),
            "ruling_explanation": record.ruling_explanation,
        })

    @gl.public.view
    def get_withdrawable_balance(self, address: str) -> str:
        addr = Address(address)
        if addr not in self.withdrawable:
            return "0"
        return str(int(self.withdrawable[addr]))
