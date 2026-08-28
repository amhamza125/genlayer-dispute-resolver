# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json


class DisputeResolver(gl.Contract):
    disputes: TreeMap[bigint, str]   # dispute_id -> ruling (JSON string)
    dispute_count: bigint

    def __init__(self):
        self.disputes = TreeMap()
        self.dispute_count = 0

    @gl.public.write
    def submit_dispute(self, claim_a: str, claim_b: str) -> None:
        def resolve():
            prompt = f"""
            You are an impartial arbitrator. Two parties disagree.
            Party A says: {claim_a}
            Party B says: {claim_b}
            Decide who is right and explain briefly.
            Respond ONLY as JSON: {{"winner": "A or B", "reason": "..."}}
            """
            result = gl.nondet.exec_prompt(prompt, response_format="json")
            return json.dumps(result, sort_keys=True)

        ruling = gl.eq_principle.prompt_comparative(
            resolve,
            principle="The rulings should agree on which party (A or B) is the winner. The reasoning does not need to match exactly, just the overall conclusion.",
        )
        self.disputes[self.dispute_count] = ruling
        self.dispute_count += 1

    @gl.public.view
    def get_ruling(self, dispute_id: int) -> str:
        return self.disputes[dispute_id]

    @gl.public.view
    def get_dispute_count(self) -> int:
        return self.dispute_count

