import hashlib
import json

import pytest

from utils.ai.schemas import ConversationTurn, CourseAuthoringPatch, LessonAuthoringSuggestion, LessonOperation, ProviderStreamRequest
from utils.ai.suggestions import SuggestionError, build_suggestion_repair_request, parse_suggestion, parse_suggestion_with_normalizations, repair_incomplete_json_object, suggestion_output_token_budget, suggestion_payload, suggestion_response_character_limit


def test_structured_output_budgets_match_capability_payload_sizes():
    assert suggestion_output_token_budget("code.suggest_changes") == 4_096
    assert suggestion_output_token_budget("blockly.suggest_changes") == 6_144
    assert suggestion_output_token_budget("lesson.suggest_changes") == 6_144
    assert suggestion_output_token_budget("stage.create") == 8_192
    assert suggestion_response_character_limit("code.suggest_changes") < suggestion_response_character_limit("stage.create")


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


def test_suggestion_repairs_only_an_incomplete_json_tail():
    fingerprint = hashlib.sha256(b"print('before')").hexdigest()
    payload = json.dumps({
        "version": "1",
        "type": "python_replace",
        "baseFingerprint": fingerprint,
        "replacement": "print('after')\n",
        "summary": "Update the output.",
    })

    assert parse_suggestion(payload[:-1], "code.suggest_changes", fingerprint).summary == "Update the output."
    assert parse_suggestion(payload[:-2], "code.suggest_changes", fingerprint).summary == "Update the output."
    assert repair_incomplete_json_object('{"version":"1","oper') is None
    assert repair_incomplete_json_object(f"{payload}\n{payload}") is None


def test_suggestion_repair_turns_stay_within_provider_message_limits():
    request = ProviderStreamRequest(
        model="test",
        system="system",
        messages=[ConversationTurn(role="user", content="Create a stage")],
    )

    repaired = build_suggestion_repair_request(
        request,
        '{"operations":[' + ("x" * 5_000),
        SuggestionError("The provider returned an invalid suggestion"),
        1,
    )

    assert len(repaired.messages[-2].content) <= 2_000
    assert "truncated for repair" in repaired.messages[-2].content
    assert len(repaired.messages[-1].content) <= 2_000


def test_repair_instruction_prescribes_flat_operation_shape():
    request = ProviderStreamRequest(model="test", system="system", messages=[ConversationTurn(role="user", content="Create a stage")])
    error = SuggestionError("The provider returned an invalid suggestion")
    error.__cause__ = ValueError("operations.0.op Field required; add_object extra")
    repaired = build_suggestion_repair_request(request, '{"operations":[{"add_object":{}}]}', error, 1)
    assert 'Wrong: {"add_object"' in repaired.messages[-1].content
    assert 'Correct: {"op":"add_object"' in repaired.messages[-1].content


def test_repair_instruction_points_invalid_activities_back_to_the_contract():
    request = ProviderStreamRequest(model="test", system="system", messages=[ConversationTurn(role="user", content="Add an activity")])
    error = SuggestionError("operations[0] op 'insert_activity' contains an invalid activity: numeric_answer unit must not be blank")
    error.__cause__ = ValueError("numeric_answer unit must not be blank")
    repaired = build_suggestion_repair_request(request, "{}", error, 1)
    assert "platform activity schema" in repaired.messages[-1].content
    assert "numeric_answer needs prompt" in repaired.messages[-1].content


def test_suggestion_payload_omits_null_optional_fields():
    suggestion = LessonAuthoringSuggestion(
        version="1",
        type="lesson_operations",
        base_revision="a" * 64,
        operations=[LessonOperation(op="update_course", course_patch=CourseAuthoringPatch(description="A new description."))],
        summary="Update the course description.",
    )
    payload = suggestion_payload(suggestion)
    assert payload["operations"][0]["coursePatch"] == {"description": "A new description."}
    assert "lessonId" not in payload["operations"][0]


def test_lesson_update_requires_an_effective_patch():
    revision = "a" * 64
    course_context = {"target": "course", "target_payload": {"course": {}, "outline": []}}
    with pytest.raises(SuggestionError, match="does not change"):
        parse_suggestion(json.dumps({
            "version": "1", "type": "lesson_operations", "baseRevision": revision, "summary": "No-op.",
            "operations": [{"op": "update_course", "coursePatch": {}}],
        }), "lesson.draft", revision, course_context)
    lesson_context = {"target": "lesson", "target_payload": {"course": {}, "lesson": {"id": 7}, "outline": []}}
    with pytest.raises(SuggestionError, match="missing its title"):
        parse_suggestion(json.dumps({
            "version": "1", "type": "lesson_operations", "baseRevision": revision, "summary": "No-op.",
            "operations": [{"op": "update_lesson", "lessonId": 7, "lessonPatch": {}}],
        }), "lesson.suggest_changes", revision, lesson_context)


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


def test_stage_create_requires_spawn_but_target_is_optional():
    fingerprint = "c" * 64
    context = {"target": "create", "selected_object_ids": [], "stage_payload": {"objects": [], "summary": {"knownObjectIds": []}}}
    suggestion = {
        "version": "1", "type": "stage_operations", "baseFingerprint": fingerprint,
        "rationale": "Create a minimal challenge.", "expectedValidation": "Spawn remains visible.", "summary": "Create stage.",
        "operations": [
            {"op": "set_metadata", "patch": {"title": "Line challenge"}},
            {"op": "add_object", "tempId": "ai-spawn", "semanticKind": "robotSpawn", "position": [-2, 0, -2]},
        ],
    }
    parsed = parse_suggestion(json.dumps(suggestion), "stage.create", fingerprint, context)
    assert parsed.type == "stage_operations"
    suggestion["operations"].append({"op": "add_object", "tempId": "ai-invalid", "semanticKind": "downloadedModel", "position": [2, 0, 2]})
    with pytest.raises(SuggestionError, match="not supported"):
        parse_suggestion(json.dumps(suggestion), "stage.create", fingerprint, context)
    suggestion["operations"] = [{"op": "set_metadata", "patch": {"title": "No spawn"}}]
    with pytest.raises(SuggestionError, match="robot spawn"):
        parse_suggestion(json.dumps(suggestion), "stage.create", fingerprint, context)


def test_stage_create_can_transform_only_objects_generated_earlier():
    fingerprint = "8" * 64
    context = {
        "target": "create",
        "selected_object_ids": [],
        "stage_payload": {"objects": [{"id": "existing-wall"}], "summary": {"knownObjectIds": ["existing-wall"]}},
    }
    base = {
        "version": "1",
        "type": "stage_operations",
        "baseFingerprint": fingerprint,
        "rationale": "Create a sized and rotated room.",
        "expectedValidation": "The generated wall has the requested dimensions and rotation.",
        "summary": "Create room.",
    }
    operations = [
        {"op": "add_object", "tempId": "ai-spawn", "semanticKind": "robotSpawn", "position": [0, 0, -2]},
        {"op": "add_object", "tempId": "ai-target", "semanticKind": "target", "position": [0, 0, 2]},
        {"op": "add_object", "tempId": "ai-wall", "semanticKind": "wall", "position": [0, 0, -3]},
        {"op": "resize_object", "objectId": "ai-wall", "dimensions": [6, 0.5, 0.08]},
        {"op": "rotate_object", "objectId": "ai-wall", "rotationY": 1.5707963267948966},
    ]
    parsed = parse_suggestion(json.dumps({**base, "operations": operations}), "stage.create", fingerprint, context)
    assert [operation.op for operation in parsed.operations[-2:]] == ["resize_object", "rotate_object"]

    operations[-1] = {"op": "rotate_object", "objectId": "existing-wall", "rotationY": 1.5707963267948966}
    with pytest.raises(SuggestionError, match="unknown object"):
        parse_suggestion(json.dumps({**base, "operations": operations}), "stage.create", fingerprint, context)


def test_stage_create_validates_requested_wall_enclosure_geometry():
    fingerprint = "7" * 64
    context = {
        "target": "create",
        "request_question": "Create a building with four walls around one room.",
        "selected_object_ids": [],
        "stage_payload": {"objects": [], "summary": {"knownObjectIds": []}},
    }
    base = {
        "version": "1",
        "type": "stage_operations",
        "baseFingerprint": fingerprint,
        "rationale": "Create a bounded challenge.",
        "expectedValidation": "The stage is usable.",
        "summary": "Create building.",
    }
    operations = [
        {"op": "add_object", "tempId": "ai-spawn", "semanticKind": "robotSpawn", "position": [0, 0, -2]},
        {"op": "add_object", "tempId": "ai-target", "semanticKind": "target", "position": [0, 0, 2]},
        {"op": "add_object", "tempId": "ai-north", "semanticKind": "wall", "position": [0, 0, -3]},
        {"op": "resize_object", "objectId": "ai-north", "dimensions": [6, 0.5, 0.08]},
        {"op": "add_object", "tempId": "ai-south", "semanticKind": "wall", "position": [0, 0, 3]},
        {"op": "resize_object", "objectId": "ai-south", "dimensions": [6, 0.5, 0.08]},
        {"op": "add_object", "tempId": "ai-west", "semanticKind": "wall", "position": [-3, 0, 0]},
        {"op": "resize_object", "objectId": "ai-west", "dimensions": [6, 0.5, 0.08]},
        {"op": "rotate_object", "objectId": "ai-west", "rotationY": 1.5707963267948966},
        {"op": "add_object", "tempId": "ai-east", "semanticKind": "wall", "position": [3, 0, 0]},
        {"op": "resize_object", "objectId": "ai-east", "dimensions": [6, 0.5, 0.08]},
        {"op": "rotate_object", "objectId": "ai-east", "rotationY": 1.5707963267948966},
    ]
    parsed = parse_suggestion(json.dumps({**base, "operations": operations}), "stage.create", fingerprint, context)
    assert len(parsed.operations) == len(operations)

    disconnected = [operation for operation in operations if operation["op"] not in {"resize_object", "rotate_object"}]
    with pytest.raises(SuggestionError, match="not geometrically closed"):
        parse_suggestion(json.dumps({**base, "operations": disconnected}), "stage.create", fingerprint, context)


def test_stage_suggestion_normalizes_only_known_unambiguous_shapes():
    fingerprint = "9" * 64
    context = {"target": "create", "selected_object_ids": [], "stage_payload": {"objects": [], "summary": {"knownObjectIds": []}}}
    nested = {
        "version": 1,
        "type": "stage_operations",
        "baseFingerprint": fingerprint,
        "rationale": "Create a minimal stage.",
        "expectedValidation": "Spawn and target exist.",
        "summary": "Create stage.",
        "operations": [
            {"add_object": {"tempId": "ai-spawn", "semanticKind": "robotSpawn", "position": [-1, 0, -1]}},
            {"op": "add_object", "add_object": {"tempId": "ai-target", "semanticKind": "target", "position": [1, 0, 1]}},
        ],
    }
    parsed, actions = parse_suggestion_with_normalizations(json.dumps(nested), "stage.create", fingerprint, context)
    assert parsed.version == "1"
    assert [operation.op for operation in parsed.operations] == ["add_object", "add_object"]
    assert actions == [
        "version:number-to-string",
        "operations.0:flatten-add_object-wrapper",
        "operations.1:flatten-add_object-wrapper",
    ]

    ambiguous = nested | {"operations": [{"add_object": {}, "unexpected": {}}]}
    with pytest.raises(SuggestionError):
        parse_suggestion(json.dumps(ambiguous), "stage.create", fingerprint, context)


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
