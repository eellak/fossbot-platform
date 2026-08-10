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


def test_lesson_suggestion_is_target_scoped_and_activity_validated():
    revision = "a" * 64
    context = {
        "target": "lesson",
        "target_payload": {"lesson": {"id": 7}, "course": {}, "outline": []},
    }
    valid = parse_suggestion(json.dumps({
        "version": "1",
        "type": "lesson_operations",
        "baseRevision": revision,
        "summary": "Add a short introduction.",
        "operations": [{
            "op": "insert_activity",
            "lessonId": 7,
            "index": 0,
            "activity": {"key": "ai-intro", "type": "rich_text", "version": 1, "required": False, "content": "Predict, then test."},
        }],
    }), "lesson.draft", revision, context)
    assert suggestion_payload(valid)["operations"][0]["activity"]["key"] == "ai-intro"

    with pytest.raises(SuggestionError, match="invalid activity"):
        parse_suggestion(json.dumps({
            "version": "1",
            "type": "lesson_operations",
            "baseRevision": revision,
            "summary": "Unsupported.",
            "operations": [{"op": "insert_activity", "lessonId": 7, "activity": {"key": "ai-bad", "type": "essay", "version": 1, "required": False}}],
        }), "lesson.draft", revision, context)

    with pytest.raises(SuggestionError, match="selected target"):
        parse_suggestion(json.dumps({
            "version": "1",
            "type": "lesson_operations",
            "baseRevision": revision,
            "summary": "Wrong scope.",
            "operations": [{"op": "update_course", "coursePatch": {"title": "Wrong"}}],
        }), "lesson.draft", revision, context)


def test_lesson_suggestion_cannot_create_mission_rules():
    revision = "b" * 64
    activity = {
        "key": "mission-1", "type": "mission", "version": 1, "required": False, "title": "Mission", "completionMode": "all",
        "objectives": [{"key": "objective-1", "role": "completion", "summary": "Reach it", "condition": {"type": "reach_target", "markerId": "goal"}}],
        "retryLimit": None, "feedbackMode": "immediate", "scoreConfig": {"version": 1, "enabled": False, "rankFailedAttempts": False, "components": [], "starThresholds": [0.5, 0.75, 0.9]},
    }
    changed = json.loads(json.dumps(activity))
    changed["objectives"][0]["condition"]["markerId"] = "different"
    context = {"target": "activity", "target_payload": {"lesson": {"id": 4}, "activity": activity}}
    with pytest.raises(SuggestionError, match="mission rules"):
        parse_suggestion(json.dumps({
            "version": "1", "type": "lesson_operations", "baseRevision": revision, "summary": "Unsafe.",
            "operations": [{"op": "replace_activity", "lessonId": 4, "activityKey": "mission-1", "activity": changed}],
        }), "lesson.suggest_changes", revision, context)
