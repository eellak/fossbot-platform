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


def test_student_previews_class_group_before_joining(client_for, users):
    tutor, _, student, _ = users
    teacher = client_for(tutor)
    learner = client_for(student)
    course, _, release = create_published_course(teacher)
    group = teacher.post("/class-groups", json={"name": "Preview class"}).json()
    teacher.post(
        f"/class-groups/{group['id']}/assignments",
        json={"course_id": course["id"], "update_policy": "pinned"},
    )

    preview = learner.get("/class-groups/preview", params={"join_code": group["join_code"]})
    assert preview.status_code == 200, preview.text
    payload = preview.json()
    assert payload["name"] == "Preview class"
    assert payload["teacher_name"] == "Teach Er"
    assert payload["member_count"] == 0
    assert payload["already_member"] is False
    assert payload["assignments"] == [{"course_title": course["title"], "release_version": release["version"]}]

    assert learner.post("/class-groups/join", json={"join_code": group["join_code"]}).status_code == 201
    joined_preview = learner.get("/class-groups/preview", params={"join_code": group["join_code"]}).json()
    assert joined_preview["member_count"] == 1
    assert joined_preview["already_member"] is True
    assert learner.get("/class-groups/preview", params={"join_code": "NOPE1234"}).status_code == 404


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


def guest_client(db, users, allowed_views=None, alias="calm_otter", include_courses=False, include_marketplace=False):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from database.database import GuestInstanceSettings, GuestSession
    from routers import classrooms, courses
    from utils.guest_access import hash_guest_token, new_guest_token

    token = new_guest_token()
    now = __import__("datetime").datetime.utcnow()
    session = GuestSession(
        alias=alias,
        token_hash=hash_guest_token(token),
        created_at=now,
        expires_at=now + __import__("datetime").timedelta(days=30),
    )
    db.add(session)
    settings = db.query(GuestInstanceSettings).filter(GuestInstanceSettings.id == 1).first()
    if settings is None:
        settings = GuestInstanceSettings(id=1, updated_by_id=users[3].id)
        db.add(settings)
    settings.allowed_views = allowed_views or ["classrooms"]
    db.commit()
    db.refresh(session)

    app = FastAPI()
    app.include_router(classrooms.router)
    if include_courses:
        app.include_router(courses.router)
    if include_marketplace:
        from routers import marketplace
        app.include_router(marketplace.router)

    def override_db():
        yield db

    app.dependency_overrides[classrooms.get_db] = override_db
    if include_courses:
        app.dependency_overrides[courses.get_db] = override_db
    if include_marketplace:
        app.dependency_overrides[marketplace.get_db] = override_db
    return TestClient(app), {"Authorization": f"Bearer {token}"}, session


def add_attempt(db, enrollment, release_id, lesson_key, activity_key, client_id, elapsed, success=True):
    from datetime import datetime

    from database.database import MissionAttempt

    attempt = MissionAttempt(
        enrollment_id=enrollment.id,
        release_id=release_id,
        lesson_key=lesson_key,
        activity_key=activity_key,
        attempt_number=db.query(MissionAttempt).filter(MissionAttempt.enrollment_id == enrollment.id).count() + 1,
        client_attempt_id=client_id,
        started_at=datetime.utcnow(),
        ended_at=datetime.utcnow(),
        outcome="succeeded" if success else "failed",
        completion_reason="objectives_met" if success else "failure_objective",
        objective_results=[{"key": "reach", "role": "completion", "status": "succeeded" if success else "pending"}],
        metrics={
            "elapsed_ms": elapsed,
            "movement_actions": 2,
            "path_distance": 1,
            "collisions": 0,
            "falls": 0,
            "resets": 0,
            "collectibles": 0,
            "checkpoints_completed": 0,
            "hints_used": 0,
            "sensor_summaries": {},
        },
        simulator_revision="sim-v2-education",
        stage_revision=STAGE["url"],
        mission_definition_hash="hash",
        schema_version=1,
    )
    db.add(attempt)
    db.commit()
    return attempt


def test_guest_joins_before_and_after_assignment_and_cannot_edit_alias(client_for, users, db):
    from database.database import ClassMembership, Enrollment

    tutor, _, _, _ = users
    teacher = client_for(tutor)
    course, lesson, _ = create_published_course(teacher)
    group = teacher.post("/class-groups", json={"name": "Guest class"}).json()
    guest, headers, session = guest_client(db, users)

    joined = guest.post("/class-groups/join", json={"join_code": group["join_code"]}, headers=headers)
    assert joined.status_code == 201, joined.text
    assert joined.json()["membership"] == {
        "display_alias": "calm_otter",
        "leaderboard_opt_in": False,
        "is_guest": True,
        "alias_editable": False,
        "joined_at": joined.json()["membership"]["joined_at"],
    }
    assert db.query(Enrollment).filter(Enrollment.guest_session_id == session.id).count() == 0

    assignment = teacher.post(
        f"/class-groups/{group['id']}/assignments",
        json={"course_id": course["id"]},
    ).json()
    enrollment = db.query(Enrollment).filter(
        Enrollment.guest_session_id == session.id,
        Enrollment.assignment_id == assignment["id"],
    ).one()
    assert enrollment.student_id is None
    assert enrollment.course_id == course["id"]
    assert enrollment.active_release_id == assignment["release_id"]
    assert joined.json()["assignments"] == []
    joined_again_after_assignment = guest.get("/class-groups/joined", headers=headers)
    assert joined_again_after_assignment.status_code == 200
    assert joined_again_after_assignment.json()[0]["assignments"][0]["enrollment_id"] == enrollment.id

    again = guest.post("/class-groups/join", json={"join_code": group["join_code"]}, headers=headers)
    assert again.status_code == 201
    assert db.query(ClassMembership).filter(ClassMembership.group_id == group["id"]).count() == 1
    assert db.query(Enrollment).filter(Enrollment.guest_session_id == session.id).count() == 1
    assert again.json()["membership"]["display_alias"] == "calm_otter"

    assert guest.put(
        f"/class-groups/{group['id']}/membership",
        json={"display_alias": "New name"},
        headers=headers,
    ).status_code == 403
    opted_in = guest.put(
        f"/class-groups/{group['id']}/membership",
        json={"leaderboard_opt_in": True},
        headers=headers,
    )
    assert opted_in.status_code == 200
    assert opted_in.json()["membership"]["display_alias"] == "calm_otter"

    joined_active = guest.post("/class-groups/join", json={"join_code": group["join_code"]}, headers=headers)
    assert joined_active.status_code == 201
    assert joined_active.json()["membership"]["leaderboard_opt_in"] is True

    assert guest.post("/class-groups/join", json={"join_code": "NOPE1234"}, headers=headers).status_code == 404
    teacher.put(f"/class-groups/{group['id']}", json={"status": "archived"})
    assert guest.post("/class-groups/join", json={"join_code": group["join_code"]}, headers=headers).status_code == 404


def test_guest_roster_analytics_and_leaderboard_privacy_with_ties(client_for, users, db):
    from database.database import Enrollment

    tutor, _, student, _ = users
    teacher = client_for(tutor)
    learner = client_for(student)
    course, lesson, release = create_published_course(teacher)
    group = teacher.post("/class-groups", json={"name": "Mixed class"}).json()
    assignment = teacher.post(
        f"/class-groups/{group['id']}/assignments",
        json={"course_id": course["id"]},
    ).json()
    challenge = teacher.post(
        f"/course-assignments/{assignment['id']}/challenges",
        json={
            "lesson_key": lesson["lesson_key"],
            "activity_key": "route",
            "board_type": "fastest",
            "tie_tolerance": 10,
            "enabled": True,
        },
    ).json()
    teacher.put(f"/class-groups/{group['id']}", json={"leaderboards_enabled": True})

    learner.post("/class-groups/join", json={"join_code": group["join_code"]})
    learner_enrollment_id = learner.get("/enrollments/mine").json()[0]["id"]
    from database.database import Enrollment as _Enrollment
    learner_enrollment = db.query(_Enrollment).filter(_Enrollment.id == learner_enrollment_id).one()
    guest, headers, session = guest_client(db, users)
    guest.post("/class-groups/join", json={"join_code": group["join_code"]}, headers=headers)
    guest_enrollment = db.query(Enrollment).filter(
        Enrollment.guest_session_id == session.id,
        Enrollment.assignment_id == assignment["id"],
    ).one()

    add_attempt(db, learner_enrollment, release["id"], lesson["lesson_key"], "route", "account-fast", 5_000)
    add_attempt(db, guest_enrollment, release["id"], lesson["lesson_key"], "route", "guest-fast", 5_005)
    learner.put(f"/class-groups/{group['id']}/membership", json={"leaderboard_opt_in": True})
    guest.put(f"/class-groups/{group['id']}/membership", json={"leaderboard_opt_in": True}, headers=headers)

    roster = teacher.get(f"/class-groups/mine").json()
    members = next(item for item in roster if item["id"] == group["id"])["members"]
    assert len(members) == 2
    guest_member = next(item for item in members if item["is_guest"])
    assert guest_member["student_username"] == "calm_otter"
    assert guest_member["display_alias"] == "calm_otter"

    board = guest.get(f"/class-challenges/{challenge['id']}/leaderboard", headers=headers)
    assert board.status_code == 200, board.text
    assert len(board.json()["entries"]) == 2
    assert board.json()["entries"][0]["rank"] == 1
    assert board.json()["entries"][1]["rank"] == 1
    assert any(entry.get("is_guest") for entry in board.json()["entries"])

    statistics = teacher.get(f"/class-challenges/{challenge['id']}/statistics").json()
    assert statistics["member_count"] == 2
    assert statistics["participant_count"] == 2
    assert statistics["successful_participant_count"] == 2

    analytics = teacher.get(f"/teach/courses/{course['id']}/progress").json()
    guest_row = next(item for item in analytics["students"] if item["student"]["is_guest"])
    assert guest_row["student"]["display_name"] == "calm_otter"
    assert guest_row["student"]["username"] == "calm_otter"
    assert guest_row["update_available"] is False

    guest.put(f"/class-groups/{group['id']}/membership", json={"leaderboard_opt_in": False}, headers=headers)
    assert guest.get(f"/class-challenges/{challenge['id']}/leaderboard", headers=headers).status_code == 403
    assert guest.get(f"/class-challenges/{challenge['id']}/statistics", headers=headers).status_code == 401

    teacher.delete(f"/class-groups/{group['id']}/members/{guest_member['id']}")
    assert guest.get(f"/class-challenges/{challenge['id']}/leaderboard", headers=headers).status_code == 404


def test_guest_results_are_isolated_by_assignment_and_release(client_for, users, db):
    from database.database import Enrollment

    tutor, _, _, _ = users
    teacher = client_for(tutor)
    course, lesson, release_one = create_published_course(teacher)
    group_one = teacher.post("/class-groups", json={"name": "Class one"}).json()
    group_two = teacher.post("/class-groups", json={"name": "Class two"}).json()
    assignment_one = teacher.post(
        f"/class-groups/{group_one['id']}/assignments", json={"course_id": course["id"]},
    ).json()
    assignment_two = teacher.post(
        f"/class-groups/{group_two['id']}/assignments", json={"course_id": course["id"]},
    ).json()
    challenge_one = teacher.post(
        f"/course-assignments/{assignment_one['id']}/challenges",
        json={"lesson_key": lesson["lesson_key"], "activity_key": "route", "board_type": "highest_score", "tie_tolerance": 0, "enabled": True},
    ).json()
    challenge_two = teacher.post(
        f"/course-assignments/{assignment_two['id']}/challenges",
        json={"lesson_key": lesson["lesson_key"], "activity_key": "route", "board_type": "highest_score", "tie_tolerance": 0, "enabled": True},
    ).json()
    for group in (group_one, group_two):
        teacher.put(f"/class-groups/{group['id']}", json={"leaderboards_enabled": True})

    guest, headers, session = guest_client(db, users)
    guest.post("/class-groups/join", json={"join_code": group_one["join_code"]}, headers=headers)
    guest.post("/class-groups/join", json={"join_code": group_two["join_code"]}, headers=headers)
    enrollment_one = db.query(Enrollment).filter(
        Enrollment.guest_session_id == session.id, Enrollment.assignment_id == assignment_one["id"],
    ).one()
    enrollment_two = db.query(Enrollment).filter(
        Enrollment.guest_session_id == session.id, Enrollment.assignment_id == assignment_two["id"],
    ).one()
    assert enrollment_one.id != enrollment_two.id
    assert enrollment_one.student_id is None and enrollment_two.student_id is None

    guest.put(f"/class-groups/{group_one['id']}/membership", json={"leaderboard_opt_in": True}, headers=headers)
    guest.put(f"/class-groups/{group_two['id']}/membership", json={"leaderboard_opt_in": True}, headers=headers)
    add_attempt(db, enrollment_one, release_one["id"], lesson["lesson_key"], "route", "only-class-one", 1_000)

    stats_one = teacher.get(f"/class-challenges/{challenge_one['id']}/statistics").json()
    stats_two = teacher.get(f"/class-challenges/{challenge_two['id']}/statistics").json()
    assert stats_one["participant_count"] == 1
    assert stats_two["participant_count"] == 0
    board_two = guest.get(f"/class-challenges/{challenge_two['id']}/leaderboard", headers=headers)
    assert board_two.status_code == 200
    assert board_two.json()["entries"] == []

    add_attempt(db, enrollment_two, release_one["id"], lesson["lesson_key"], "route", "only-class-two", 2_000)
    assert teacher.get(f"/class-challenges/{challenge_one['id']}/statistics").json()["participant_count"] == 1
    assert teacher.get(f"/class-challenges/{challenge_two['id']}/statistics").json()["participant_count"] == 1

    changed = scored_mission()
    changed["title"] = "New release scoring"
    teacher.put(f"/courses/{course['id']}/lessons/{lesson['id']}", json={"activities": [changed]})
    release_two = teacher.post(f"/courses/{course['id']}/publish").json()
    teacher.put(f"/course-assignments/{assignment_one['id']}", json={"release_id": release_two["id"]})
    db.refresh(enrollment_one)
    assert enrollment_one.active_release_id == release_two["id"]
    challenge_new_release = teacher.post(
        f"/course-assignments/{assignment_one['id']}/challenges",
        json={"lesson_key": lesson["lesson_key"], "activity_key": "route", "board_type": "highest_score", "tie_tolerance": 0, "enabled": True},
    ).json()
    assert teacher.get(f"/class-challenges/{challenge_new_release['id']}/statistics").json()["participant_count"] == 0
    add_attempt(db, enrollment_one, release_two["id"], lesson["lesson_key"], "route", "new-release", 3_000)
    assert teacher.get(f"/class-challenges/{challenge_new_release['id']}/statistics").json()["participant_count"] == 1


def learning_table_counts(db):
    from database.database import (
        AIUsageEvent,
        ActivityAnswer,
        Enrollment,
        LessonProgress,
        LessonWorkspace,
        LocalStage,
        MissionAttempt,
        Projects,
        SourceProviderConnection,
        User,
    )

    return {
        "users": db.query(User).count(),
        "projects": db.query(Projects).count(),
        "local_stages": db.query(LocalStage).count(),
        "lesson_workspaces": db.query(LessonWorkspace).count(),
        "activity_answers": db.query(ActivityAnswer).count(),
        "lesson_progress": db.query(LessonProgress).count(),
        "mission_attempts": db.query(MissionAttempt).count(),
        "enrollments": db.query(Enrollment).count(),
        "ai_usage": db.query(AIUsageEvent).count(),
        "provider_connections": db.query(SourceProviderConnection).count(),
    }


def test_guest_course_browsing_workspace_and_server_mutations_are_denied_without_writes(client_for, users, db):
    from database.database import Enrollment

    tutor, _, _, _ = users
    teacher = client_for(tutor)
    course, lesson, release = create_published_course(teacher)
    group = teacher.post("/class-groups", json={"name": "Guest course class"}).json()
    assignment = teacher.post(
        f"/class-groups/{group['id']}/assignments", json={"course_id": course["id"]},
    ).json()
    guest, headers, session = guest_client(db, users, ["classrooms", "courses"], include_courses=True)
    guest.post("/class-groups/join", json={"join_code": group["join_code"]}, headers=headers)
    enrollment = db.query(Enrollment).filter(
        Enrollment.guest_session_id == session.id, Enrollment.assignment_id == assignment["id"],
    ).one()

    before = learning_table_counts(db)
    listed = guest.get("/enrollments/mine", headers=headers)
    assert listed.status_code == 200, listed.text
    assert [item["id"] for item in listed.json()] == [enrollment.id]
    assert listed.json()[0]["update_available"] is False
    assert guest.get("/courses", headers=headers).status_code == 200
    assert guest.get(f"/courses/{course['id']}", headers=headers).status_code == 200
    assert guest.get(f"/enrollments/{enrollment.id}", headers=headers).status_code == 200
    activities = guest.get(
        f"/enrollments/{enrollment.id}/lessons/{lesson['lesson_key']}/activities", headers=headers,
    )
    assert activities.status_code == 200, activities.text
    assert all(item["submitted_value"] is None for item in activities.json())

    workspace = f"/enrollments/{enrollment.id}/lessons/{lesson['lesson_key']}/workspace"
    assert guest.get(workspace, headers=headers).status_code == 403
    assert guest.put(workspace, json={"content": "print('guest')", "revision": 1, "release_id": release["id"]}, headers=headers).status_code == 403
    assert guest.post(f"{workspace}/reset", json={"revision": 1, "release_id": release["id"]}, headers=headers).status_code == 403
    assert guest.get(
        f"/enrollments/{enrollment.id}/lessons/{lesson['lesson_key']}/workspace-history", headers=headers,
    ).status_code == 403
    assert guest.post(
        f"/enrollments/{enrollment.id}/lessons/{lesson['lesson_key']}/start", headers=headers,
    ).status_code == 403
    assert guest.post(
        f"/enrollments/{enrollment.id}/lessons/{lesson['lesson_key']}/complete", headers=headers,
    ).status_code == 403
    assert guest.post(
        f"/enrollments/{enrollment.id}/update-release",
        json={"current_release_id": release["id"], "target_release_id": release["id"]},
        headers=headers,
    ).status_code == 403
    assert guest.post(f"/courses/{course['id']}/enroll", headers=headers).status_code == 403
    assert guest.get("/courses/mine", headers=headers).status_code == 401
    assert guest.get(f"/courses/{course['id']}/draft", headers=headers).status_code == 401
    assert guest.post(f"/courses/{course['id']}/publish", headers=headers).status_code == 401
    assert guest.get("/enrollments/999999", headers=headers).status_code == 404

    draft_response = teacher.post("/courses", json={**COURSE, "title": "Private draft"})
    assert draft_response.status_code == 201, draft_response.text
    draft = draft_response.json()
    listed_ids = [item["id"] for item in guest.get("/courses", headers=headers).json()]
    assert draft["id"] not in listed_ids
    assert guest.get(f"/courses/{draft['id']}", headers=headers).status_code == 404

    assert learning_table_counts(db) == before


def test_guest_enrollment_does_not_auto_pull_a_newer_release(client_for, users, db):
    from database.database import Enrollment

    tutor, _, _, _ = users
    teacher = client_for(tutor)
    course, _, release_one = create_published_course(teacher)
    group = teacher.post("/class-groups", json={"name": "Pinned release class"}).json()
    assignment = teacher.post(
        f"/class-groups/{group['id']}/assignments",
        json={"course_id": course["id"], "update_policy": "pinned"},
    ).json()
    guest, headers, session = guest_client(db, users, ["classrooms", "courses"], include_courses=True)
    guest.post("/class-groups/join", json={"join_code": group["join_code"]}, headers=headers)
    from utils.guest_access import clear_guest_throttles
    clear_guest_throttles()
    enrollment = db.query(Enrollment).filter(
        Enrollment.guest_session_id == session.id,
        Enrollment.assignment_id == assignment["id"],
    ).one()

    teacher.put(f"/courses/{course['id']}", json={"description": "A newer course version."})
    release_two = teacher.post(f"/courses/{course['id']}/publish").json()
    assert release_two["version"] == 2
    assert guest.get(f"/courses/{course['id']}", headers=headers).status_code == 200
    listed = guest.get("/enrollments/mine", headers=headers).json()[0]
    assert listed["active_release"]["id"] == release_one["id"]
    db.refresh(enrollment)
    assert enrollment.active_release_id == release_one["id"]


def test_guest_mission_submission_is_scoped_idempotent_and_creates_no_workspace_rows(client_for, users, db, monkeypatch):
    from database.database import Enrollment, MissionAttempt

    tutor, _, _, _ = users
    teacher = client_for(tutor)
    course, lesson, release = create_published_course(teacher)
    released_mission = release["snapshot"]["lessons"][0]["activities"][0]
    group = teacher.post("/class-groups", json={"name": "Guest attempt class"}).json()
    assignment = teacher.post(
        f"/class-groups/{group['id']}/assignments", json={"course_id": course["id"]},
    ).json()
    challenge = teacher.post(
        f"/course-assignments/{assignment['id']}/challenges",
        json={"lesson_key": lesson["lesson_key"], "activity_key": "route", "board_type": "highest_score", "tie_tolerance": 0, "enabled": True},
    ).json()
    teacher.put(f"/class-groups/{group['id']}", json={"leaderboards_enabled": True})
    guest, headers, session = guest_client(db, users, ["classrooms", "courses"], include_courses=True)
    guest.post("/class-groups/join", json={"join_code": group["join_code"]}, headers=headers)
    enrollment = db.query(Enrollment).filter(
        Enrollment.guest_session_id == session.id, Enrollment.assignment_id == assignment["id"],
    ).one()
    path = f"/enrollments/{enrollment.id}/lessons/{lesson['lesson_key']}/missions/route/attempts"

    before = learning_table_counts(db)
    stale = attempt_payload("0" * 64, client_id="stale")
    assert guest.post(path, json=stale, headers=headers).status_code == 409
    assert learning_table_counts(db) == before

    payload = attempt_payload(released_mission["definitionHash"], client_id="guest-attempt-1")
    first = guest.post(path, json=payload, headers=headers)
    assert first.status_code == 201, first.text
    after = learning_table_counts(db)
    assert after["mission_attempts"] == before["mission_attempts"] + 1
    assert after["activity_answers"] == before["activity_answers"] + 1
    assert after["lesson_progress"] == before["lesson_progress"] + 1
    assert after["lesson_workspaces"] == before["lesson_workspaces"] == 0
    assert after["projects"] == before["projects"]
    assert after["local_stages"] == before["local_stages"]
    assert after["users"] == before["users"]
    assert after["ai_usage"] == before["ai_usage"]
    assert after["provider_connections"] == before["provider_connections"]

    duplicate = guest.post(path, json=payload, headers=headers)
    assert duplicate.status_code == 201
    assert duplicate.json()["id"] == first.json()["id"]
    assert db.query(MissionAttempt).filter(MissionAttempt.enrollment_id == enrollment.id).count() == 1

    attempts = guest.get(path, headers=headers)
    summary = guest.get(path.replace("/attempts", "/summary"), headers=headers)
    assert attempts.status_code == 200 and len(attempts.json()) == 1
    assert summary.status_code == 200
    assert summary.json()["latest_completed"]["outcome"] == "succeeded"

    guest.put(f"/class-groups/{group['id']}/membership", json={"leaderboard_opt_in": True}, headers=headers)
    board = guest.get(f"/class-challenges/{challenge['id']}/leaderboard", headers=headers)
    assert board.status_code == 200 and board.json()["entries"][0]["is_guest"] is True

    other_guest, other_headers, _ = guest_client(db, users, ["classrooms", "courses"], alias="brave_fox", include_courses=True)
    other_guest.post("/class-groups/join", json={"join_code": group["join_code"]}, headers=other_headers)
    other_enrollment = db.query(Enrollment).filter(
        Enrollment.guest_session_id != session.id, Enrollment.assignment_id == assignment["id"],
    ).one()
    assert guest.post(
        f"/enrollments/{other_enrollment.id}/lessons/{lesson['lesson_key']}/missions/route/attempts",
        json=attempt_payload(released_mission["definitionHash"], client_id="forged-enrollment"),
        headers=headers,
    ).status_code == 404

    guest.delete(f"/class-groups/{group['id']}/membership", headers=headers)
    assert guest.get("/enrollments/mine", headers=headers).json() == []
    assert guest.post(path, json=attempt_payload(released_mission["definitionHash"], client_id="after-leave"), headers=headers).status_code == 404
    assert learning_table_counts(db)["mission_attempts"] == after["mission_attempts"]

    from database.database import GuestInstanceSettings
    settings = db.query(GuestInstanceSettings).one()
    settings.allowed_views = ["courses"]
    db.commit()
    assert guest.get(f"/enrollments/{enrollment.id}", headers=headers).status_code == 403
    assert guest.get(f"/courses/{course['id']}", headers=headers).status_code == 200


def test_guest_marketplace_index_is_read_only_and_view_gated(client_for, users, db, monkeypatch):
    from routers import marketplace

    monkeypatch.setattr(marketplace, "cached_public_marketplace_index", lambda force_refresh=False: {
        "generatedAt": "2026-01-01T00:00:00Z", "schemaVersion": 1, "stages": [], "warning": None,
    })
    guest, headers, _ = guest_client(db, users, ["stages"], include_marketplace=True)
    before = learning_table_counts(db)
    index = guest.get("/api/marketplace/index", headers=headers)
    assert index.status_code == 200, index.text
    assert index.json()["stages"] == []
    assert learning_table_counts(db) == before
    assert guest.post("/api/marketplace/reports", json={"owner": "x", "repoName": "y", "reason": "test"}, headers=headers).status_code == 401

    from database.database import GuestInstanceSettings
    settings = db.query(GuestInstanceSettings).one()
    settings.allowed_views = ["classrooms"]
    db.commit()
    assert guest.get("/api/marketplace/index", headers=headers).status_code == 403
