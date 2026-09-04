# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from dataclasses import dataclass
import json


@allow_storage
@dataclass
class DisputeRecord:
    party_a: Address
    party_b: Address
    evidence_url_a: str
    evidence_url_b: str
    stake_a: bigint
    stake_b: bigint
    status: str  # "AWAITING_RESPONSE" | "AWAITING_RESOLUTION" | "RESOLVED"
    winner: Address
    ruling_explanation: str


class DisputeResolver(gl.Contract):
    """
    On-chain dispute arbitration with authenticated parties, verifiable
    evidence, and an enforceable settlement.

    1. Authentication -- each party is identified by their own
       transaction sender address, not typed in by a single caller.
       Party A opens the dispute and names a counterparty; only that
       exact address can respond as Party B.
    2. Verifiable evidence -- each party submits a URL, fetched directly
       on-chain by the contract (no oracle). The ruling is grounded in
       evidence anyone can independently re-fetch and check.
    3. Enforceable settlement -- both parties stake GEN when they join.
       The consensus ruling determines who receives the combined stake,
       released via a pull-payment withdraw pattern.
    """

    disputes: TreeMap[str, DisputeRecord]
    dispute_count: bigint
    withdrawable: TreeMap[Address, bigint]

    def __init__(self):
        # Do not re-instantiate TreeMap storage fields here. 
        # Only initialize primitive storage counters.
        self.dispute_count = bigint(0)

    @gl.public.write.payable
    def open_dispute(self, counterparty: str, evidence_url: str) -> str:
        sender = gl.message.sender_address
        stake = gl.message.value

        if stake <= 0:
            raise gl.vm.UserError("must stake a positive amount to open a dispute")
        if len(evidence_url.strip()) == 0:
            raise gl.vm.UserError("evidence_url cannot be empty")

        self.dispute_count += 1
        dispute_id = str(self.dispute_count)

        self.disputes[dispute_id] = DisputeRecord(
            party_a=sender,
            party_b=Address(counterparty),
            evidence_url_a=evidence_url,
            evidence_url_b="",
            stake_a=stake,
            stake_b=bigint(0),
            status="AWAITING_RESPONSE",
            winner=Address("0x0000000000000000000000000000000000000000"),
            ruling_explanation="",
        )
        return dispute_id

    @gl.public.write.payable
    def respond_dispute(self, dispute_id: str, evidence_url: str) -> None:
        if dispute_id not in self.disputes:
            raise gl.vm.UserError("dispute not found")

        record = self.disputes[dispute_id]
        if record.status != "AWAITING_RESPONSE":
            raise gl.vm.UserError("dispute is not awaiting a response")

        sender = gl.message.sender_address
        if sender != record.party_b:
            raise gl.vm.UserError("only the named counterparty can respond to this dispute")

        stake = gl.message.value
        if stake <= 0:
            raise gl.vm.UserError("must stake a positive amount to respond")
        if len(evidence_url.strip()) == 0:
            raise gl.vm.UserError("evidence_url cannot be empty")

        record.evidence_url_b = evidence_url
        record.stake_b = stake
        record.status = "AWAITING_RESOLUTION"
        self.disputes[dispute_id] = record

    @gl.public.write
    def resolve_dispute(self, dispute_id: str) -> None:
        if dispute_id not in self.disputes:
            raise gl.vm.UserError("dispute not found")

        record = self.disputes[dispute_id]
        if record.status != "AWAITING_RESOLUTION":
            raise gl.vm.UserError("dispute is not ready to be resolved")

        url_a = record.evidence_url_a
        url_b = record.evidence_url_b
        party_a = record.party_a
        party_b = record.party_b

        def judge():
            evidence_a = gl.nondet.web.render(url_a, mode="text")
            evidence_b = gl.nondet.web.render(url_b, mode="text")

            prompt = f"""
            You are an impartial arbitrator. Two parties in a dispute
            have each submitted a URL as evidence supporting their case.

            PARTY A EVIDENCE ({url_a}):
            {evidence_a}

            PARTY B EVIDENCE ({url_b}):
            {evidence_b}

            Based only on this evidence, decide which party's position is
            better supported. Respond ONLY as JSON:
            {{"winner": "A or B", "explanation": "..."}}
            """
            result = gl.nondet.exec_prompt(prompt, response_format="json")
            winner = str(result.get("winner", "")).strip().upper()
            explanation = str(result.get("explanation", "")).strip()

            if winner not in ("A", "B"):
                raise gl.vm.UserError(f"invalid winner returned by model: {winner!r}")
            if not explanation:
                raise gl.vm.UserError("model response missing an explanation")

            return json.dumps({"winner": winner, "explanation": explanation}, sort_keys=True)

        agreed = gl.eq_principle.prompt_comparative(
            judge,
            principle=(
                "The rulings should agree on which party (A or B) is the "
                "winner based on the evidence. The explanation wording "
                "does not need to match exactly, just the conclusion."
            ),
        )

        data = json.loads(agreed)
        winner_side = data["winner"]
        winner_address = party_a if winner_side == "A" else party_b

        total_pot = record.stake_a + record.stake_b
        current = self.withdrawable[winner_address] if winner_address in self.withdrawable else bigint(0)
        self.withdrawable[winner_address] = current + total_pot

        record.winner = winner_address
        record.ruling_explanation = data["explanation"]
        record.status = "RESOLVED"
        self.disputes[dispute_id] = record

    @gl.public.write
    def withdraw(self) -> None:
        sender = gl.message.sender_address
        amount = self.withdrawable[sender] if sender in self.withdrawable else bigint(0)
        if amount <= 0:
            raise gl.vm.UserError("nothing to withdraw")

        self.withdrawable[sender] = bigint(0)
        recipient = gl.get_contract_at(sender)
        recipient.emit_transfer(value=amount)

    @gl.public.view
    def get_dispute(self, dispute_id: str) -> str:
        if dispute_id not in self.disputes:
            raise gl.vm.UserError("dispute not found")
        record = self.disputes[dispute_id]
        return json.dumps({
            "party_a": str(record.party_a),
            "party_b": str(record.party_b),
            "evidence_url_a": record.evidence_url_a,
            "evidence_url_b": record.evidence_url_b,
            "stake_a": str(record.stake_a),
            "stake_b": str(record.stake_b),
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
        
