from database.database import Course, Lesson, MarketplaceRoleAssignment, User
from database.dev_seed import DEV_SAMPLE_TAG, DEV_TEST_USERS, seed_dev_sample_course, seed_dev_test_users
from models.models import UserRole
from utils.utils_hash import verify_hashed


def test_dev_sample_course_is_compact_owned_and_idempotent(db, users):
    *_, admin = users

    created = seed_dev_sample_course(db, admin.username)
    seeded_again = seed_dev_sample_course(db, admin.username)

    assert seeded_again.id == created.id
    assert db.query(Course).filter(Course.author_id == admin.id).count() == 1
    assert DEV_SAMPLE_TAG in created.tags
    assert created.status == "draft"
    assert created.visibility == "unlisted"

    lessons = db.query(Lesson).filter(Lesson.course_id == created.id).order_by(Lesson.position).all()
    assert len(lessons) == 3
    assert [lesson.position for lesson in lessons] == [1, 2, 3]
    assert [lesson.editor_type for lesson in lessons] == ["python", "python", "blockly"]
    assert [lesson.start_mode for lesson in lessons] == ["fresh", "inherit_previous_code", "fresh"]
    assert [lesson.stage_source_type for lesson in lessons] == ["default", None, "default"]
    assert lessons[2].starter_content["xml"].startswith("<xml")


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
    assert db.query(Lesson).filter(Lesson.course_id == course.id).count() == 3


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
