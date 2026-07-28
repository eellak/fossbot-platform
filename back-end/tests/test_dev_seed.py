from database.database import Course, Lesson, MarketplaceRoleAssignment, User
from database.dev_seed import (
    DEV_SAMPLE_PHASE_5_TAG,
    DEV_SAMPLE_PHASE_6_TAG,
    DEV_SAMPLE_TAG,
    DEV_TEST_USERS,
    seed_dev_sample_course,
    seed_dev_test_users,
)
from models.models import UserRole
from utils.utils_hash import verify_hashed


def test_dev_sample_course_covers_phase_five_and_six_and_is_idempotent(db, users):
    *_, admin = users

    created = seed_dev_sample_course(db, admin.username)
    seeded_again = seed_dev_sample_course(db, admin.username)

    assert seeded_again.id == created.id
    assert db.query(Course).filter(Course.author_id == admin.id).count() == 1
    assert DEV_SAMPLE_TAG in created.tags
    assert DEV_SAMPLE_PHASE_5_TAG in created.tags
    assert DEV_SAMPLE_PHASE_6_TAG in created.tags
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
        "/js-simulator/stages/stage_missions_phase6.json"
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
    course = seed_dev_sample_course(db, admin.username)
    course.status = "archived"
    course.title = "Locally edited sample"
    db.commit()

    restored = seed_dev_sample_course(db, admin.username)

    assert restored.id == course.id
    assert restored.status == "draft"
    assert restored.title == "Locally edited sample"
    assert db.query(Lesson).filter(Lesson.course_id == course.id).count() == 12


def test_dev_users_include_two_teachers_one_verifier_and_two_students(db):
    seeded = seed_dev_test_users(db, "shared-dev-password")
    seeded_again = seed_dev_test_users(db, "shared-dev-password")

    assert [user.id for user in seeded_again] == [user.id for user in seeded]
    assert db.query(User).filter(User.username.in_([item["username"] for item in DEV_TEST_USERS])).count() == 4
    assert len([user for user in seeded if user.role == UserRole.TUTOR]) == 2
    assert len([user for user in seeded if user.role == UserRole.USER]) == 2
    assert all(user.activated and user.provider == "local" for user in seeded)
    assert all(verify_hashed("shared-dev-password", user.hashed_password) for user in seeded)

    verifier = next(user for user in seeded if user.username == "dev_teacher_verifier")
    assignments = db.query(MarketplaceRoleAssignment).filter(MarketplaceRoleAssignment.role == "verifier").all()
    assert [assignment.user_id for assignment in assignments] == [verifier.id]
