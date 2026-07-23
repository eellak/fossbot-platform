import logging

from database.database import Course, Lesson, MarketplaceRoleAssignment, User
from models.models import UserRole
from sqlalchemy.orm import Session
from utils.utils_hash import get_hashed


logger = logging.getLogger("uvicorn")
DEV_SAMPLE_TAG = "dev-education-sample"
DEV_TEST_USERS = (
    {"username": "dev_teacher", "firstname": "Dev", "lastname": "Teacher", "email": "dev.teacher@fossbot.test", "role": UserRole.TUTOR},
    {"username": "dev_teacher_verifier", "firstname": "Dev", "lastname": "Verifier", "email": "dev.verifier@fossbot.test", "role": UserRole.TUTOR},
    {"username": "dev_student", "firstname": "Dev", "lastname": "Student", "email": "dev.student@fossbot.test", "role": UserRole.USER},
    {"username": "dev_student_two", "firstname": "Dev", "lastname": "Student Two", "email": "dev.student.two@fossbot.test", "role": UserRole.USER},
)
DEV_VERIFIER_USERNAME = "dev_teacher_verifier"


def seed_dev_test_users(db: Session, password: str) -> list[User]:
    """Ensure predictable local development accounts and marketplace roles."""
    password_hash = get_hashed(password)
    users: list[User] = []
    for definition in DEV_TEST_USERS:
        user = db.query(User).filter(User.username == definition["username"]).first()
        if user is None:
            user = User(**definition)
            db.add(user)
        else:
            user.firstname = definition["firstname"]
            user.lastname = definition["lastname"]
            user.email = definition["email"]
            user.role = definition["role"]
        user.hashed_password = password_hash
        user.activated = True
        user.access_revoked = False
        user.provider = "local"
        user.beta_tester = False
        users.append(user)
    db.flush()

    verifier = next(user for user in users if user.username == DEV_VERIFIER_USERNAME)
    assignment = db.query(MarketplaceRoleAssignment).filter(
        MarketplaceRoleAssignment.user_id == verifier.id,
        MarketplaceRoleAssignment.role == "verifier",
    ).first()
    if assignment is None:
        db.add(MarketplaceRoleAssignment(user_id=verifier.id, role="verifier"))
    db.commit()
    logger.info("Development test users ready: %s", ", ".join(user.username for user in users))
    return users


def rich_text_activity(key: str, *paragraphs: str) -> list[dict]:
    return [{
        "key": key,
        "type": "rich_text",
        "version": 1,
        "content": {
            "type": "doc",
            "content": [
                {"type": "paragraph", "content": [{"type": "text", "text": paragraph}]}
                for paragraph in paragraphs
            ],
        },
    }]


def seed_dev_sample_course(db: Session, admin_username: str) -> Course:
    """Create the editable education sample once, retaining developer changes."""
    admin = db.query(User).filter(User.username == admin_username, User.role == UserRole.ADMIN).first()
    if admin is None:
        raise RuntimeError(f"Development course seed requires admin user {admin_username!r}")

    existing = next(
        (course for course in db.query(Course).filter(Course.author_id == admin.id).all() if DEV_SAMPLE_TAG in (course.tags or [])),
        None,
    )
    if existing:
        if existing.status == "archived":
            existing.status = "draft"
            db.commit()
            db.refresh(existing)
            logger.info("Development education sample restored")
        else:
            logger.info("Development education sample already exists")
        return existing

    course = Course(
        title="Education authoring playground",
        description="A compact development course for exercising the Phase 2 teacher authoring workflow.",
        author_id=admin.id,
        learning_objectives=[
            "Author structured lesson instructions",
            "Configure reproducible starter code and simulator stages",
            "Test fresh and inherited lesson workspaces",
        ],
        status="draft",
        visibility="unlisted",
        age_range="10–16",
        difficulty="Beginner",
        estimated_duration_minutes=25,
        prerequisites="No prior robotics experience required.",
        tags=[DEV_SAMPLE_TAG, "education", "development"],
    )
    db.add(course)
    db.flush()

    lessons = [
        Lesson(
            lesson_key="dev-python-fresh",
            course_id=course.id,
            title="Move from a fresh Python workspace",
            position=1,
            activities=rich_text_activity(
                "dev-python-intro",
                "Read the instructions, inspect the built-in stage, and edit the starter program.",
                "Use Check starter to validate syntax without running the simulator.",
            ),
            completion_policy="self",
            start_mode="fresh",
            editor_type="python",
            starter_content="for step in range(3):\n    move_step('forward')\n",
            simulator_settings={"showSimulator": True},
            stage_source_type="default",
            stage_title="Maze",
            stage_url="/js-simulator/stages/stage_maze.json",
        ),
        Lesson(
            lesson_key="dev-python-inherit",
            course_id=course.id,
            title="Continue the previous program",
            position=2,
            activities=rich_text_activity(
                "dev-python-inherit",
                "This lesson inherits the previous Python workspace while simulator state resets.",
                "It intentionally has no stage, demonstrating that stages are optional.",
            ),
            completion_policy="activity",
            start_mode="inherit_previous_code",
            editor_type="python",
            starter_content=None,
            simulator_settings={"showSimulator": False},
        ),
        Lesson(
            lesson_key="dev-blockly-fresh",
            course_id=course.id,
            title="Build a fresh Blockly solution",
            position=3,
            activities=rich_text_activity(
                "dev-blockly-intro",
                "Open the visual starter workspace and rearrange the movement blocks.",
                "Reorder this lesson to exercise insert and swap indicators in the outline.",
            ),
            completion_policy="teacher_review",
            start_mode="fresh",
            editor_type="blockly",
            starter_content={
                "xml": '<xml xmlns="https://developers.google.com/blockly/xml"><block type="move_step" x="48" y="48"><field name="option">\'forward\'</field></block></xml>',
            },
            simulator_settings={"showSimulator": True},
            stage_source_type="default",
            stage_title="White field",
            stage_url="/js-simulator/stages/stage_white_rect.json",
        ),
    ]
    db.add_all(lessons)
    db.commit()
    db.refresh(course)
    logger.info("Development education sample created for admin user %s", admin_username)
    return course


def seed_dev_data(db: Session, admin_username: str, test_user_password: str) -> Course:
    seed_dev_test_users(db, test_user_password)
    return seed_dev_sample_course(db, admin_username)
