from __future__ import annotations

import ast
import json
import xml.etree.ElementTree as ET
from typing import Union

from pydantic import ValidationError

from utils.ai.schemas import BlocklyReplaceSuggestion, PythonReplaceSuggestion


SUGGESTION_VERSION = "1"
MAX_SUGGESTION_RESPONSE_CHARACTERS = 32_000
Suggestion = Union[PythonReplaceSuggestion, BlocklyReplaceSuggestion]


class SuggestionError(ValueError):
    pass


def parse_suggestion(raw: str, capability: str, expected_fingerprint: str) -> Suggestion:
    if len(raw) > MAX_SUGGESTION_RESPONSE_CHARACTERS:
        raise SuggestionError("The provider suggestion exceeded the allowed size")
    try:
        payload = json.loads(raw.strip())
        suggestion = (
            PythonReplaceSuggestion.model_validate(payload)
            if capability == "code.suggest_changes"
            else BlocklyReplaceSuggestion.model_validate(payload)
        )
    except (json.JSONDecodeError, ValidationError, TypeError) as error:
        raise SuggestionError("The provider returned an invalid suggestion") from error
    expected_type = "python_replace" if capability == "code.suggest_changes" else "blockly_replace"
    if suggestion.type != expected_type or suggestion.base_fingerprint != expected_fingerprint:
        raise SuggestionError("The provider suggestion does not match the current workspace")
    validate_suggestion(suggestion)
    return suggestion


def validate_suggestion(suggestion: Suggestion) -> None:
    if isinstance(suggestion, PythonReplaceSuggestion):
        try:
            ast.parse(suggestion.replacement)
        except SyntaxError as error:
            raise SuggestionError("The suggested Python is not syntactically valid") from error
        return
    try:
        root = ET.fromstring(suggestion.xml)
    except ET.ParseError as error:
        raise SuggestionError("The suggested Blockly XML is malformed") from error
    if root.tag.split("}")[-1] != "xml":
        raise SuggestionError("The suggested Blockly workspace must have an xml root")


def suggestion_payload(suggestion: Suggestion) -> dict:
    return suggestion.model_dump(by_alias=True)
