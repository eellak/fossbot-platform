import database.dev_seed as dev_seed
from database.database import AIInstanceSettings, AIPolicyRule, AIProviderConfig, Course, CourseRelease, Lesson, MarketplaceRoleAssignment, User
from database.dev_seed import (
    DEV_SAMPLE_LESSONS_TAG,
    DEV_SAMPLE_MISSIONS_TAG,
    DEV_SAMPLE_TAG,
    DEV_TEST_USERS,
    DEV_AI_PROVIDER_NAME,
    EDUCATION_EXAMPLE_TAG,
    education_example_definitions,
    seed_education_example_courses,
    seed_dev_education_data,
    seed_dev_test_users,
    seed_dev_ai_data,
)
from models.models import UserRole
from utils.utils_hash import verify_hashed


def test_dev_sample_course_covers_activity_and_evaluation_lessons_and_is_idempotent(db, users):
    *_, admin = users

    created = seed_dev_education_data(db, admin.username)
    seeded_again = seed_dev_education_data(db, admin.username)

    assert seeded_again.id == created.id
    assert db.query(Course).filter(Course.author_id == admin.id).count() == 1
    assert DEV_SAMPLE_TAG in created.tags
    assert DEV_SAMPLE_LESSONS_TAG in created.tags
    assert DEV_SAMPLE_MISSIONS_TAG in created.tags
    assert created.status == "draft"
    assert created.visibility == "unlisted"

    lessons = db.query(Lesson).filter(Lesson.course_id == created.id).order_by(Lesson.position).all()
    assert len(lessons) == 12
    assert [lesson.position for lesson in lessons] == list(range(1, 13))
    assert [lesson.editor_type for lesson in lessons] == [
        "python", "python", "blockly", "none", "none", "none", "none",
        "python", "none", "python", "python", "python",
    ]
    assert [lesson.start_mode for lesson in lessons] == [
        "fresh", "inherit_previous_code", "fresh", "fresh", "fresh", "fresh",
        "fresh", "fresh", "fresh", "fresh", "fresh", "fresh",
    ]
    assert [lesson.completion_policy for lesson in lessons] == [
        "self", "activity", "teacher_review", "self", "hybrid", "activity",
        "teacher_review", "activity", "activity", "activity", "activity", "self",
    ]
    assert [lesson.stage_source_type for lesson in lessons] == [
        "default", None, "default", None, "default", "default", "default",
        "default", "default", "default", "default", "default",
    ]
    assert lessons[2].starter_content["xml"].startswith("<xml")

    activities = [activity for lesson in lessons for activity in lesson.activities]
    assert {activity["type"] for activity in activities} == {
        "rich_text", "multiple_choice", "multiple_select", "numeric_answer",
        "short_reflection", "simulator_observation", "mission", "hint",
    }
    observations = [activity for activity in activities if activity["type"] == "simulator_observation"]
    assert {activity["sensorHelperMode"] for activity in observations} == {"hidden", "student_toggle", "always_visible"}
    assert {activity["tolerance"]["mode"] for activity in activities if activity["type"] == "numeric_answer"} == {"absolute", "percentage"}
    assert {activity["forActivityKey"] for activity in activities if activity["type"] == "hint"} == {"dev-mixed-choice", "dev-review-run"}

    mission_lessons = lessons[7:]
    assert {lesson.stage_url for lesson in mission_lessons} == {
        "/js-simulator/stages/stage_mission_challenge.json"
    }
    missions = [
        activity
        for lesson in mission_lessons
        for activity in lesson.activities
        if activity["type"] == "mission"
    ]
    assert len(missions) == 5
    assert {mission["completionMode"] for mission in missions} == {"all", "any"}
    assert {mission["feedbackMode"] for mission in missions} == {
        "immediate", "after_attempt"
    }
    assert {mission["required"] for mission in missions} == {True, False}
    assert {mission["retryLimit"] for mission in missions} == {None, 1, 2, 3}
    objectives = [
        objective for mission in missions for objective in mission["objectives"]
    ]
    assert {objective["role"] for objective in objectives} == {
        "completion", "failure", "optional"
    }
    assert {objective["condition"]["type"] for objective in objectives} == {
        "reach_target",
        "checkpoints",
        "collect",
        "avoid_zones",
        "stop_in_target",
        "object_in_zone",
        "no_incident",
        "sensor_threshold",
        "actuator_state",
        "limits",
    }


def test_archived_dev_sample_is_restored_without_replacing_lessons(db, users):
    *_, admin = users
    course = seed_dev_education_data(db, admin.username)
    course.status = "archived"
    course.title = "Locally edited sample"
    db.commit()

    restored = seed_dev_education_data(db, admin.username)

    assert restored.id == course.id
    assert restored.status == "draft"
    assert restored.title == "Locally edited sample"
    assert db.query(Lesson).filter(Lesson.course_id == course.id).count() == 12


def test_dev_users_include_admin_two_teachers_one_verifier_and_two_students(db):
    seeded = seed_dev_test_users(db, "shared-dev-password")
    seeded_again = seed_dev_test_users(db, "shared-dev-password")

    assert [user.id for user in seeded_again] == [user.id for user in seeded]
    assert db.query(User).filter(User.username.in_([item["username"] for item in DEV_TEST_USERS])).count() == 5
    assert len([user for user in seeded if user.role == UserRole.ADMIN]) == 1
    assert len([user for user in seeded if user.role == UserRole.TUTOR]) == 2
    assert len([user for user in seeded if user.role == UserRole.USER]) == 2
    assert all(user.activated and user.provider == "local" for user in seeded)
    assert all(verify_hashed("shared-dev-password", user.hashed_password) for user in seeded)

    verifier = next(user for user in seeded if user.username == "dev_teacher_verifier")
    assignments = db.query(MarketplaceRoleAssignment).filter(MarketplaceRoleAssignment.role == "verifier").all()
    assert [assignment.user_id for assignment in assignments] == [verifier.id]


def test_dev_ai_seed_is_test_only_complete_and_idempotent(db, users, monkeypatch):
    *_, admin = users
    monkeypatch.setenv("AI_ENABLE_TEST_PROVIDER", "true")
    monkeypatch.setenv("ENVIRONMENT", "development")

    created = seed_dev_ai_data(db, admin.username)
    seeded_again = seed_dev_ai_data(db, admin.username)

    assert created is not None and seeded_again is not None
    assert created.id == seeded_again.id
    assert created.name == DEV_AI_PROVIDER_NAME
    assert created.model == "fossbot-test" and created.enabled is True
    assert db.query(AIProviderConfig).filter(AIProviderConfig.name == DEV_AI_PROVIDER_NAME).count() == 1
    settings = db.query(AIInstanceSettings).filter(AIInstanceSettings.id == 1).one()
    assert settings.enabled is True and settings.default_provider_id == created.id
    assert db.query(AIPolicyRule).filter(AIPolicyRule.scope_type == "instance").count() == 8

    monkeypatch.setenv("ENVIRONMENT", "production")
    assert seed_dev_ai_data(db, admin.username) is None


def test_education_examples_publish_three_courses_and_eight_lessons(db, users):
    tutor, *_ = users
    created = seed_education_example_courses(db, tutor.username)
    seeded_again = seed_education_example_courses(db, tutor.username)

    assert [course.id for course in seeded_again] == [course.id for course in created]
    assert len(created) == 3
    assert sum(db.query(Lesson).filter(Lesson.course_id == course.id).count() for course in created) == 8
    assert all(course.status == "published" and course.latest_published_release_id for course in created)
    assert db.query(CourseRelease).filter(CourseRelease.course_id.in_([course.id for course in created])).count() == 3
    assert all(EDUCATION_EXAMPLE_TAG in course.tags for course in created)

    lessons = db.query(Lesson).filter(Lesson.course_id.in_([course.id for course in created])).all()
    assert any(lesson.start_mode == "inherit_previous_code" for lesson in lessons)
    assert any(lesson.editor_type == "none" and lesson.stage_source_type is None for lesson in lessons)
    assert any(any(activity["type"] == "simulator_observation" for activity in lesson.activities) for lesson in lessons)
    assert any(any(activity["type"] == "mission" for activity in lesson.activities) for lesson in lessons)
    assert any(any(activity.get("scoreConfig", {}).get("enabled") for activity in lesson.activities) for lesson in lessons)
    assert len(education_example_definitions()) == 3


def test_seed_dev_data_runs_all_current_seed_steps(db, monkeypatch):
    calls = []
    sample = object()
    monkeypatch.setattr(dev_seed, "seed_dev_test_users", lambda session, password: calls.append(("users", session, password)))
    monkeypatch.setattr(dev_seed, "seed_dev_ai_data", lambda session, username: calls.append(("ai", session, username)))
    monkeypatch.setattr(dev_seed, "seed_dev_sample_course", lambda session, username: calls.append(("course", session, username)) or sample)
    monkeypatch.setattr(dev_seed, "seed_education_example_courses", lambda session: calls.append(("examples", session)))

    result = dev_seed.seed_dev_data(db, "dev_admin", "password")

    assert result is sample
    assert calls == [
        ("users", db, "password"),
        ("ai", db, "dev_admin"),
        ("course", db, "dev_admin"),
        ("examples", db),
    ]
