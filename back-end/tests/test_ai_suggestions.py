import hashlib
import json

import pytest

from utils.ai.suggestions import SuggestionError, parse_suggestion, suggestion_payload


def test_python_suggestion_requires_valid_syntax_and_fingerprint():
    fingerprint = hashlib.sha256(b"print('before')").hexdigest()
    valid = parse_suggestion(json.dumps({
        "version": "1",
        "type": "python_replace",
        "baseFingerprint": fingerprint,
        "replacement": "print('after')\n",
        "summary": "Update the output.",
    }), "code.suggest_changes", fingerprint)
    assert suggestion_payload(valid)["baseFingerprint"] == fingerprint

    with pytest.raises(SuggestionError, match="syntactically"):
        parse_suggestion(json.dumps({
            "version": "1",
            "type": "python_replace",
            "baseFingerprint": fingerprint,
            "replacement": "if :",
            "summary": "Broken.",
        }), "code.suggest_changes", fingerprint)


def test_blockly_suggestion_requires_well_formed_xml_and_matching_fingerprint():
    fingerprint = hashlib.sha256(b"<xml></xml>").hexdigest()
    valid = parse_suggestion(json.dumps({
        "version": "1",
        "type": "blockly_replace",
        "baseFingerprint": fingerprint,
        "xml": "<xml><block type='text_print' id='one'/></xml>",
        "summary": "Add a print block.",
    }), "blockly.suggest_changes", fingerprint)
    assert valid.type == "blockly_replace"

    with pytest.raises(SuggestionError):
        parse_suggestion(json.dumps({
            "version": "1",
            "type": "blockly_replace",
            "baseFingerprint": "0" * 64,
            "xml": "<xml>",
            "summary": "Broken.",
        }), "blockly.suggest_changes", fingerprint)
