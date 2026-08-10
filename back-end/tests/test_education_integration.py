import copy

import pytest

from database.database import MissionAttempt, User
from models.models import UserRole
from utils.activity_schema import validate_activities
from utils.scoring import evaluate_score, validate_score_config


COURSE = {
    "title": "Scored navigation",
    "description": "Practise efficient robot navigation.",
    "learning_objectives": ["Reach a target and compare approaches"],
}
STAGE = {
    "sourceType": "default",
    "title": "Mission stage",
    "url": "/js-simulator/stages/stage_mission_challenge.json",
}


def score_config():
    return {
        "version": 1,
        "enabled": True,
        "rankFailedAttempts": False,
        "components": [
            {"key": "objective", "label": "Reach the target", "type": "objective", "objectiveKey": "reach", "points": 100, "weight": 1},
            {"key": "collect", "label": "Collectibles", "type": "collectibles", "pointsPerUnit": 5, "maximumUnits": 5, "weight": 1},
            {"key": "time", "label": "Time bonus", "type": "time_bonus", "points": 50, "target": 5_000, "tolerance": 2_000, "weight": 1},
            {"key": "moves", "label": "Movement efficiency", "type": "movement_efficiency", "points": 30, "target": 2, "tolerance": 3, "weight": 1},
            {"key": "path", "label": "Path efficiency", "type": "path_efficiency", "points": 20, "target": 1, "tolerance": 1, "weight": 1},
            {"key": "collisions", "label": "Collision deduction", "type": "collision_penalty", "pointsPerIncident": 10, "maximumPenalty": 30, "weight": 1},
        ],
        "starThresholds": [0.5, 0.75, 0.9],
    }


def scored_mission(*, enabled=True):
    mission = {
        "key": "route",
        "type": "mission",
        "version": 1,
        "required": False,
        "title": "Efficient route",
        "completionMode": "all",
        "objectives": [{
            "key": "reach",
            "role": "completion",
            "summary": "Reach the target.",
            "condition": {"type": "reach_target", "markerId": "green-target"},
        }],
        "retryLimit": None,
        "feedbackMode": "after_attempt",
    }
    if enabled:
        mission["scoreConfig"] = score_config()
    return mission


def create_published_course(teacher):
    course_response = teacher.post("/courses", json=COURSE)
    assert course_response.status_code == 201, course_response.text
    course = course_response.json()
    lesson_response = teacher.post(
        f"/courses/{course['id']}/lessons",
        json={
            "title": "Route mission",
            "activities": [scored_mission()],
            "completion_policy": "self",
            "stageReference": STAGE,
        },
    )
    assert lesson_response.status_code == 201, lesson_response.text
    release_response = teacher.post(f"/courses/{course['id']}/publish")
    assert release_response.status_code == 201, release_response.text
    return course, lesson_response.json(), release_response.json()


def attempt_payload(definition_hash, *, client_id, succeeded=True, elapsed=5_000, moves=2, distance=1, collisions=0, collectibles=0):
    return {
        "schema_version": 1,
        "client_attempt_id": client_id,
        "started_at": "2026-07-27T10:00:00Z",
        "ended_at": "2026-07-27T10:00:05Z",
        "outcome": "succeeded" if succeeded else "failed",
        "completion_reason": "objectives_met" if succeeded else "failure_objective",
        "objective_results": [{
            "key": "reach",
            "role": "completion",
            "status": "succeeded" if succeeded else "pending",
        }],
        "metrics": {
            "elapsed_ms": elapsed,
            "movement_actions": moves,
            "path_distance": distance,
            "collisions": collisions,
            "falls": 0,
            "resets": 0,
            "collectibles": collectibles,
            "checkpoints_completed": 0,
            "hints_used": 0,
            "sensor_summaries": {},
        },
        "simulator_revision": "sim-v2-education",
        "stage_revision": STAGE["url"],
        "mission_definition_hash": definition_hash,
        "client_total": 999_999,
    }


def test_score_evaluator_components_floors_and_determinism():
    activity = scored_mission()
    objectives = [{"key": "reach", "role": "completion", "status": "succeeded"}]
    metrics = {
        "elapsed_ms": 6_000,
        "movement_actions": 3,
        "path_distance": 1.5,
        "collisions": 1,
        "falls": 0,
        "resets": 0,
        "collectibles": 2,
        "checkpoints_completed": 0,
        "hints_used": 0,
    }
    first = evaluate_score(activity["scoreConfig"], activity, "succeeded", objectives, metrics)
    second = evaluate_score(copy.deepcopy(activity["scoreConfig"]), activity, "succeeded", objectives, copy.deepcopy(metrics))
    assert first == second
    assert first["total"] == 155
    assert first["maximum"] == 225
    assert first["rank_eligible"] is True
    by_type = {item["type"]: item for item in first["breakdown"]}
    assert by_type["movement_efficiency"]["measured"] == 3
    assert by_type["path_efficiency"]["measured"] == 1.5
    assert by_type["collision_penalty"]["earned"] == -10
    assert len(first["config_hash"]) == 64

    with_accuracy = copy.deepcopy(activity["scoreConfig"])
    with_accuracy["components"].append({
        "key": "accuracy",
        "label": "Numeric answer accuracy",
        "type": "numeric_accuracy",
        "points": 40,
        "weight": 1,
    })
    accuracy_result = evaluate_score(
        with_accuracy,
        activity,
        "succeeded",
        objectives,
        metrics | {"numeric_answer_accuracy": 0.5},
    )
    accuracy = next(item for item in accuracy_result["breakdown"] if item["type"] == "numeric_accuracy")
    assert accuracy["earned"] == 20
    assert accuracy["maximum"] == 40

    invalid = copy.deepcopy(activity["scoreConfig"])
    next(item for item in invalid["components"] if item["type"] == "time_bonus")["target"] = 100
    with pytest.raises(ValueError, match="target"):
        validate_score_config(invalid, activity["objectives"])


def test_scoring_disabled_and_server_recomputed_personal_feedback(client_for, users, db):
    tutor, _, student, _ = users
    teacher = client_for(tutor)
    course, lesson, release = create_published_course(teacher)
    released_mission = release["snapshot"]["lessons"][0]["activities"][0]
    assert released_mission["scoreConfig"]["version"] == 1

    learner = client_for(student)
    enrollment = learner.post(f"/courses/{course['id']}/enroll").json()
    path = f"/enrollments/{enrollment['id']}/lessons/{lesson['lesson_key']}/missions/route/attempts"
    first = learner.post(path, json=attempt_payload(
        released_mission["definitionHash"],
        client_id="scored-1",
        elapsed=6_000,
        moves=3,
        distance=1.5,
        collisions=1,
        collectibles=2,
    ))
    assert first.status_code == 201, first.text
    assert first.json()["score"]["total"] == 155
    assert first.json()["score"]["total"] != 999_999
    assert first.json()["lesson_completed"] is False

    second = learner.post(path, json=attempt_payload(
        released_mission["definitionHash"],
        client_id="scored-2",
        elapsed=4_000,
        moves=2,
        distance=0.8,
        collisions=0,
        collectibles=4,
    ))
    assert second.status_code == 201, second.text
    payload = second.json()
    assert payload["score"]["total"] == 220
    assert payload["personal_feedback"]["best_score"]["id"] == payload["id"]
    assert payload["personal_feedback"]["improvement"]["score_delta"] == 65
    assert payload["personal_feedback"]["best_movement_actions"] == 2
    assert payload["personal_feedback"]["best_path_distance"] == 0.8
    stored = db.query(MissionAttempt).filter(MissionAttempt.id == payload["id"]).one()
    assert stored.score_config_version == 1
    assert stored.score_config_hash == payload["score"]["config_hash"]
    duplicate = learner.post(path, json=attempt_payload(
        released_mission["definitionHash"],
        client_id="scored-2",
        elapsed=4_000,
        moves=2,
        distance=0.8,
        collisions=0,
        collectibles=4,
    ))
    assert duplicate.status_code == 201
    assert duplicate.json()["id"] == payload["id"]
    assert duplicate.json()["activity_state"]["satisfied"] is True

    disabled_course = teacher.post("/courses", json=COURSE | {"title": "Completion without points"}).json()
    disabled_lesson = teacher.post(
        f"/courses/{disabled_course['id']}/lessons",
        json={"title": "No score", "activities": [scored_mission(enabled=False)], "stageReference": STAGE},
    ).json()
    disabled_release = teacher.post(f"/courses/{disabled_course['id']}/publish").json()
    disabled_enrollment = learner.post(f"/courses/{disabled_course['id']}/enroll").json()
    disabled_activity = disabled_release["snapshot"]["lessons"][0]["activities"][0]
    disabled_path = f"/enrollments/{disabled_enrollment['id']}/lessons/{disabled_lesson['lesson_key']}/missions/route/attempts"
    disabled = learner.post(disabled_path, json=attempt_payload(disabled_activity["definitionHash"], client_id="unscored"))
    assert disabled.status_code == 201
    assert disabled.json()["score"] is None


def test_numeric_accuracy_is_derived_from_stored_lesson_answers(client_for, users):
    tutor, _, student, _ = users
    teacher = client_for(tutor)
    mission = scored_mission()
    mission["scoreConfig"]["components"].append({
        "key": "accuracy",
        "label": "Measurement accuracy",
        "type": "numeric_accuracy",
        "points": 25,
        "weight": 1,
    })
    course = teacher.post("/courses", json=COURSE | {"title": "Measured navigation"}).json()
    lesson = teacher.post(
        f"/courses/{course['id']}/lessons",
        json={
            "title": "Measure and move",
            "activities": [{
                "key": "distance",
                "type": "numeric_answer",
                "version": 1,
                "required": False,
                "prompt": "What distance did you measure?",
                "expectedValue": 1,
                "unit": "m",
                "tolerance": {"mode": "absolute", "value": 0.05},
            }, mission],
            "completion_policy": "self",
            "stageReference": STAGE,
        },
    ).json()
    release = teacher.post(f"/courses/{course['id']}/publish").json()
    released_mission = release["snapshot"]["lessons"][0]["activities"][1]
    learner = client_for(student)
    enrollment = learner.post(f"/courses/{course['id']}/enroll").json()
    answer = learner.post(
        f"/enrollments/{enrollment['id']}/lessons/{lesson['lesson_key']}/activities/distance/submit",
        json={"submission_id": "measurement-1", "value": 1.02},
    )
    assert answer.status_code == 200, answer.text
    result = learner.post(
        f"/enrollments/{enrollment['id']}/lessons/{lesson['lesson_key']}/missions/route/attempts",
        json=attempt_payload(released_mission["definitionHash"], client_id="numeric-score"),
    )
    assert result.status_code == 201, result.text
    accuracy = next(item for item in result.json()["score"]["breakdown"] if item["type"] == "numeric_accuracy")
    assert accuracy == {
        "key": "accuracy",
        "label": "Measurement accuracy",
        "type": "numeric_accuracy",
        "earned": 25.0,
        "maximum": 25.0,
        "measured": 1.0,
    }


def test_class_group_privacy_opt_in_release_scope_and_analytics(client_for, users, db):
    tutor, other_tutor, student, _ = users
    teacher = client_for(tutor)
    other_teacher = client_for(other_tutor)
    course, lesson, release_one = create_published_course(teacher)
    released_mission = release_one["snapshot"]["lessons"][0]["activities"][0]

    second_student = User(
        username="second-student",
        firstname="Second",
        lastname="Student",
        email="second-student@example.test",
        hashed_password="unused",
        role=UserRole.USER,
        beta_tester=True,
        activated=True,
    )
    db.add(second_student)
    db.commit()
    learner_one = client_for(student)
    learner_two = client_for(second_student)

    group_one = teacher.post("/class-groups", json={"name": "Class one"}).json()
    group_two = teacher.post("/class-groups", json={"name": "Class two"}).json()
    assert group_one["leaderboards_enabled"] is False
    assert group_one["members"] == []
    assert other_teacher.put(f"/class-groups/{group_one['id']}", json={"name": "Stolen"}).status_code == 404

    assignment_one = teacher.post(
        f"/class-groups/{group_one['id']}/assignments",
        json={"course_id": course["id"], "update_policy": "student_choice"},
    ).json()
    teacher.post(
        f"/class-groups/{group_two['id']}/assignments",
        json={"course_id": course["id"], "update_policy": "pinned"},
    )
    joined_one = learner_one.post("/class-groups/join", json={"join_code": group_one["join_code"]}).json()
    joined_two = learner_two.post("/class-groups/join", json={"join_code": group_two["join_code"]}).json()
    assert joined_one["membership"]["leaderboard_opt_in"] is False
    assert joined_one["membership"]["display_alias"].startswith("Learner-")
    assert joined_two["id"] == group_two["id"]

    challenge = teacher.post(
        f"/course-assignments/{assignment_one['id']}/challenges",
        json={
            "lesson_key": lesson["lesson_key"],
            "activity_key": "route",
            "board_type": "highest_score",
            "tie_tolerance": 0,
            "enabled": False,
        },
    ).json()
    board_path = f"/class-challenges/{challenge['id']}/leaderboard"
    assert learner_one.get(board_path).status_code == 403
    teacher.put(f"/class-groups/{group_one['id']}", json={"leaderboards_enabled": True})
    teacher.put(f"/class-challenges/{challenge['id']}", json={"enabled": True})
    assert learner_one.get(board_path).status_code == 403

    enrollment_one = learner_one.get("/enrollments/mine").json()[0]
    enrollment_two = learner_two.get("/enrollments/mine").json()[0]
    attempt_path_one = f"/enrollments/{enrollment_one['id']}/lessons/{lesson['lesson_key']}/missions/route/attempts"
    attempt_path_two = f"/enrollments/{enrollment_two['id']}/lessons/{lesson['lesson_key']}/missions/route/attempts"
    learner_one.post(attempt_path_one, json=attempt_payload(
        released_mission["definitionHash"],
        client_id="group-one-failed",
        succeeded=False,
        elapsed=500,
        collisions=1,
    ))
    learner_one.post(attempt_path_one, json=attempt_payload(released_mission["definitionHash"], client_id="group-one-success"))
    learner_two.post(attempt_path_two, json=attempt_payload(released_mission["definitionHash"], client_id="group-two-success"))

    learner_one.put(
        f"/class-groups/{group_one['id']}/membership",
        json={"display_alias": "Blue Robot", "leaderboard_opt_in": True},
    )
    board = learner_one.get(board_path)
    assert board.status_code == 200, board.text
    board_payload = board.json()
    assert board_payload["release_id"] == release_one["id"]
    assert board_payload["entries"] == [{"rank": 1, "alias": "Blue Robot", "value": 200.0}]
    assert "student" not in str(board_payload).lower()
    assert "firstname" not in str(board_payload).lower()
    assert "second-student" not in str(board_payload)
    assert board_payload["friendly_competition"] is True

    teacher.put(f"/class-challenges/{challenge['id']}", json={"board_type": "fastest", "tie_tolerance": 100})
    speedrun = learner_one.get(board_path)
    assert speedrun.status_code == 200
    assert speedrun.json()["entries"] == [{"rank": 1, "alias": "Blue Robot", "value": 5000.0}]
    assert learner_one.get("/leaderboards").status_code == 404

    statistics_path = f"/class-challenges/{challenge['id']}/statistics"
    statistics = teacher.get(statistics_path)
    assert statistics.status_code == 200, statistics.text
    assert statistics.json() | {"outcomes": {}} == {
        "challenge_id": challenge["id"],
        "activity_title": "Efficient route",
        "board_type": "fastest",
        "release_version": 1,
        "season": 1,
        "member_count": 1,
        "opted_in_count": 1,
        "participant_count": 1,
        "successful_participant_count": 1,
        "attempt_count": 2,
        "successful_attempt_count": 1,
        "success_rate": 50.0,
        "average_value": 5000.0,
        "best_value": 5000.0,
        "outcomes": {},
    }
    assert statistics.json()["outcomes"] == {"failed": 1, "succeeded": 1}
    assert other_teacher.get(statistics_path).status_code == 404
    assert learner_one.get(statistics_path).status_code == 403

    learner_one.put(
        f"/class-groups/{group_one['id']}/membership",
        json={"leaderboard_opt_in": False},
    )
    assert learner_one.get(board_path).status_code == 403
    summary_path = f"/enrollments/{enrollment_one['id']}/lessons/{lesson['lesson_key']}/missions/route/summary"
    assert learner_one.get(summary_path).status_code == 200

    changed = scored_mission()
    changed["title"] = "New release scoring"
    teacher.put(
        f"/courses/{course['id']}/lessons/{lesson['id']}",
        json={"activities": [changed]},
    )
    release_two = teacher.post(f"/courses/{course['id']}/publish").json()
    teacher.put(f"/course-assignments/{assignment_one['id']}", json={"release_id": release_two["id"]})
    release_two_challenge = teacher.post(
        f"/course-assignments/{assignment_one['id']}/challenges",
        json={
            "lesson_key": lesson["lesson_key"],
            "activity_key": "route",
            "board_type": "highest_score",
            "tie_tolerance": 0,
            "enabled": False,
        },
    )
    assert release_two_challenge.status_code == 201, release_two_challenge.text
    assert release_two_challenge.json()["release_id"] != challenge["release_id"]

    analytics = teacher.get(f"/teach/courses/{course['id']}/progress")
    assert analytics.status_code == 200, analytics.text
    analytics_payload = analytics.json()
    assert analytics_payload["enrollment_count"] == 2
    assert analytics_payload["common_outcome_reasons"]["collision"] == 1
    assert "objectives_met" not in analytics_payload["common_outcome_reasons"]
    assert "raw sensor" in " ".join(analytics_payload["retention"]["excludes"])
    assert "saved_content" not in str(analytics_payload)
    assert other_teacher.get(f"/teach/courses/{course['id']}/progress").status_code == 404


def test_score_schema_rejects_invalid_configuration():
    invalid = scored_mission()
    invalid["scoreConfig"]["components"][0]["objectiveKey"] = "missing"
    with pytest.raises(ValueError, match="reference"):
        validate_activities([invalid])
