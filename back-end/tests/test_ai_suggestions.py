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


def test_suggestion_accepts_one_json_object_wrapped_in_reasoning_and_markdown():
    fingerprint = hashlib.sha256(b"print('before')").hexdigest()
    raw = """<think>I should return a complete replacement.</think>
```json
{"version":"1","type":"python_replace","baseFingerprint":"%s","replacement":"print('after')\\n","summary":"Update the output."}
```""" % fingerprint

    parsed = parse_suggestion(raw, "code.suggest_changes", fingerprint)

    assert parsed.replacement == "print('after')\n"


def test_suggestion_rejects_ambiguous_multiple_json_objects():
    fingerprint = hashlib.sha256(b"print('before')").hexdigest()
    payload = json.dumps({
        "version": "1",
        "type": "python_replace",
        "baseFingerprint": fingerprint,
        "replacement": "print('after')\n",
        "summary": "Update the output.",
    })

    with pytest.raises(SuggestionError, match="invalid suggestion"):
        parse_suggestion(f"{payload}\n{payload}", "code.suggest_changes", fingerprint)


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


def test_stage_create_requires_supported_spawn_and_target():
    fingerprint = "c" * 64
    context = {"target": "create", "selected_object_ids": [], "stage_payload": {"objects": [], "summary": {"knownObjectIds": []}}}
    suggestion = {
        "version": "1", "type": "stage_operations", "baseFingerprint": fingerprint,
        "rationale": "Create a minimal challenge.", "expectedValidation": "Spawn and target remain visible.", "summary": "Create stage.",
        "operations": [
            {"op": "set_metadata", "patch": {"title": "Line challenge"}},
            {"op": "add_object", "tempId": "ai-spawn", "semanticKind": "robotSpawn", "position": [-2, 0, -2]},
            {"op": "add_object", "tempId": "ai-target", "semanticKind": "target", "position": [2, 0, 2]},
        ],
    }
    parsed = parse_suggestion(json.dumps(suggestion), "stage.create", fingerprint, context)
    assert parsed.type == "stage_operations"
    suggestion["operations"][2]["semanticKind"] = "downloadedModel"
    with pytest.raises(SuggestionError, match="not supported"):
        parse_suggestion(json.dumps(suggestion), "stage.create", fingerprint, context)


def test_stage_selection_rejects_unknown_unselected_and_invalid_geometry():
    fingerprint = "d" * 64
    context = {
        "target": "selection", "selected_object_ids": ["wall-1"],
        "stage_payload": {"objects": [{"id": "wall-1"}], "summary": {"knownObjectIds": ["wall-1", "wall-2"]}},
    }
    base = {
        "version": "1", "type": "stage_operations", "baseFingerprint": fingerprint,
        "rationale": "Move the selection.", "expectedValidation": "Keep valid dimensions.", "summary": "Move wall.",
    }
    with pytest.raises(SuggestionError, match="unselected"):
        parse_suggestion(json.dumps({**base, "operations": [{"op": "move_object", "objectId": "wall-2", "position": [1, 0, 1]}]}), "stage.suggest_changes", fingerprint, context)
    with pytest.raises(SuggestionError, match="dimensions"):
        parse_suggestion(json.dumps({**base, "operations": [{"op": "resize_object", "objectId": "wall-1", "dimensions": [1, -1, 1]}]}), "stage.suggest_changes", fingerprint, context)
    with pytest.raises(SuggestionError, match="unknown"):
        parse_suggestion(json.dumps({**base, "operations": [{"op": "remove_object", "objectId": "missing"}]}), "stage.suggest_changes", fingerprint, context)


def test_stage_suggestion_rejects_asset_fields_and_stale_fingerprint():
    fingerprint = "e" * 64
    context = {"target": "stage", "selected_object_ids": [], "stage_payload": {"objects": [{"id": "wall-1"}], "summary": {"knownObjectIds": ["wall-1"]}}}
    payload = {
        "version": "1", "type": "stage_operations", "baseFingerprint": fingerprint,
        "rationale": "Keep assets private.", "expectedValidation": "No asset changes.", "summary": "Update wall.",
        "operations": [{"op": "update_object", "objectId": "wall-1", "patch": {"source": "data:model/gltf;base64,secret"}}],
    }
    with pytest.raises(SuggestionError, match="unsupported fields"):
        parse_suggestion(json.dumps(payload), "stage.suggest_changes", fingerprint, context)
    payload["operations"] = [{"op": "move_object", "objectId": "wall-1", "position": [1, 0, 1]}]
    with pytest.raises(SuggestionError, match="current workspace"):
        parse_suggestion(json.dumps(payload), "stage.suggest_changes", "f" * 64, context)
