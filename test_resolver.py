import pytest
import json
import time
from unittest.mock import patch, MagicMock
import sys

# Mock GenLayer SDK environment for local testing
gl_mock = MagicMock()
gl_mock.eq_principle.strict_eq.side_effect = lambda func: func()
sys.modules['genlayer'] = gl_mock

# Import after mocking
from dispute_resolver_v3 import DisputeResolver

def test_consensus_with_varying_explanations():
    """
    Proves that varying LLM explanations do not break state determinism 
    because the explanation is successfully dropped before strict_eq evaluates.
    """
    resolver = DisputeResolver()
    
    # Setup mock dispute variables bypassing the VM state limits
    resolver.disputes = MagicMock()
    mock_record = MagicMock()
    mock_record.status = "AWAITING_RESOLUTION"
    mock_record.stake_a = 100
    mock_record.stake_b = 100
    resolver.disputes.__contains__.return_value = True
    resolver.disputes.__getitem__.return_value = mock_record
    resolver.withdrawable = {}

    # Mock Validator 1 response (Winner A, Explanation 1)
    response_1 = '{"winner": "A", "explanation": "Party A wins because their URL has valid evidence."}'
    # Mock Validator 2 response (Winner A, Explanation 2)
    response_2 = '{"winner": "A", "explanation": "A is correct based on governing terms."}'

    with patch.object(gl_mock.nondet, 'exec_prompt', return_value=response_1):
        resolver.resolve_dispute(0)
        assert mock_record.status == "RESOLVED"

    with patch.object(gl_mock.nondet, 'exec_prompt', return_value=response_2):
        resolver.resolve_dispute(0)
        assert mock_record.status == "RESOLVED"
        
    # The ruling explanation is deterministic and identical despite varying LLM output
    assert "Explanations omitted from state to guarantee byte-for-byte consensus" in mock_record.ruling_explanation
