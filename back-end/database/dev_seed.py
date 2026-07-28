import logging

from models.models import UserRole
from sqlalchemy.orm import Session
from utils.utils_hash import get_hashed

from database.database import Course, Lesson, MarketplaceRoleAssignment, User

logger = logging.getLogger("uvicorn")
DEV_SAMPLE_TAG = "dev-education-sample"
DEV_TEST_USERS = (
    {
        "username": "dev_teacher",
        "firstname": "Dev",
        "lastname": "Teacher",
        "email": "dev.teacher@fossbot.test",
        "role": UserRole.TUTOR,
        "beta_tester": True,
    },
    {
        "username": "dev_teacher_verifier",
        "firstname": "Dev",
        "lastname": "Verifier",
        "email": "dev.verifier@fossbot.test",
        "role": UserRole.TUTOR,
        "beta_tester": True,
    },
    {
        "username": "dev_student",
        "firstname": "Dev",
        "lastname": "Student",
        "email": "dev.student@fossbot.test",
        "role": UserRole.USER,
        "beta_tester": True,
    },
    {
        "username": "dev_student_two",
        "firstname": "Dev",
        "lastname": "Student Two",
        "email": "dev.student.two@fossbot.test",
        "role": UserRole.USER,
        "beta_tester": False,
    },
)
DEV_VERIFIER_USERNAME = "dev_teacher_verifier"
DEV_SAMPLE_PHASE_5_TAG = "education-phase-5"


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
            user.beta_tester = definition["beta_tester"]
        user.hashed_password = password_hash
        user.activated = True
        user.access_revoked = False
        user.provider = "local"
        users.append(user)
    db.flush()

    verifier = next(user for user in users if user.username == DEV_VERIFIER_USERNAME)
    assignment = (
        db.query(MarketplaceRoleAssignment)
        .filter(
            MarketplaceRoleAssignment.user_id == verifier.id,
            MarketplaceRoleAssignment.role == "verifier",
        )
        .first()
    )
    if assignment is None:
        db.add(MarketplaceRoleAssignment(user_id=verifier.id, role="verifier"))
    db.commit()
    logger.info(
        "Development test users ready: %s", ", ".join(user.username for user in users)
    )
    return users


def rich_text_activity(key: str, *paragraphs: str) -> list[dict]:
    return [
        {
            "key": key,
            "type": "rich_text",
            "version": 1,
            "content": {
                "type": "doc",
                "content": [
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": paragraph}],
                    }
                    for paragraph in paragraphs
                ],
            },
        }
    ]


def phase_five_sample_lessons(course_id: int, start_position: int = 4) -> list[Lesson]:
    """Return focused lessons covering every Phase 5 authoring and student flow."""
    return [
        Lesson(
            lesson_key="dev-activities-mixed",
            course_id=course_id,
            title="Mix questions, reflection, and hints",
            position=start_position,
            activities=rich_text_activity(
                "dev-mixed-intro",
                "Phase 5 lessons are readable activity sequences rather than a single instruction block.",
                "Answer the questions, reflect privately, and open the hint only if you need it.",
            )
            + [
                {
                    "key": "dev-mixed-choice",
                    "type": "multiple_choice",
                    "version": 1,
                    "required": True,
                    "prompt": "Which sensor measures distance in front of FOSSBot?",
                    "options": [
                        {"key": "ultrasonic", "label": "Front ultrasonic"},
                        {"key": "microphone", "label": "Microphone"},
                        {"key": "floor", "label": "Floor sensor"},
                    ],
                    "correctOptionKey": "ultrasonic",
                    "feedbackCorrect": "Correct—the front ultrasonic sensor reports distance in metres.",
                    "feedbackIncorrect": "Look for the sensor that reports a distance rather than light, sound, or a floor state.",
                },
                {
                    "key": "dev-mixed-select",
                    "type": "multiple_select",
                    "version": 1,
                    "required": False,
                    "prompt": "Which two statistics describe the extremes of a run?",
                    "options": [
                        {"key": "minimum", "label": "Minimum"},
                        {"key": "maximum", "label": "Maximum"},
                        {"key": "average", "label": "Average"},
                    ],
                    "correctOptionKeys": ["minimum", "maximum"],
                    "feedbackCorrect": "Yes. Minimum and maximum are the two extremes.",
                    "feedbackIncorrect": "Choose the lowest and highest recorded values.",
                },
                {
                    "key": "dev-mixed-reflection",
                    "type": "short_reflection",
                    "version": 1,
                    "required": False,
                    "prompt": "Where might a distance sensor help a robot?",
                    "collectResponse": False,
                },
                {
                    "key": "dev-mixed-hint",
                    "type": "hint",
                    "version": 1,
                    "required": False,
                    "forActivityKey": "dev-mixed-choice",
                    "content": "A front-facing distance sensor helps the robot notice obstacles before contact.",
                },
            ],
            completion_policy="self",
            start_mode="fresh",
            editor_type="none",
            starter_content=None,
            simulator_settings={"showSimulator": False},
        ),
        Lesson(
            lesson_key="dev-ultrasonic-observation",
            course_id=course_id,
            title="Measure an ultrasonic run without code",
            position=start_position + 1,
            activities=rich_text_activity(
                "dev-ultrasonic-intro",
                "Use the movement controls to approach an obstacle, then study the permitted chart.",
                "The computed minimum is hidden: estimate it from the chart and answer with metres.",
            )
            + [
                {
                    "key": "dev-ultrasonic-prediction",
                    "type": "multiple_choice",
                    "version": 1,
                    "required": True,
                    "prompt": "What should happen to the ultrasonic reading as the robot approaches the wall?",
                    "options": [
                        {"key": "decrease", "label": "It should decrease"},
                        {"key": "increase", "label": "It should increase"},
                        {"key": "unchanged", "label": "It should stay unchanged"},
                    ],
                    "correctOptionKey": "decrease",
                    "feedbackCorrect": "Correct. A closer obstacle produces a smaller distance.",
                    "feedbackIncorrect": "Run the robot toward the wall and watch the live value change.",
                },
                {
                    "key": "dev-ultrasonic-run",
                    "type": "simulator_observation",
                    "version": 1,
                    "required": True,
                    "prompt": "Run the robot toward the wall and record the observation.",
                    "allowedSensors": ["ultrasonic-front"],
                    "sensorHelperMode": "student_toggle",
                    "presentations": ["live", "chart", "summary"],
                    "capturedStatistics": [
                        "minimum",
                        "maximum",
                        "average",
                        "finalValue",
                    ],
                    "visibleStatistics": ["maximum", "average", "finalValue"],
                },
                {
                    "key": "dev-ultrasonic-minimum",
                    "type": "numeric_answer",
                    "version": 1,
                    "required": True,
                    "prompt": "What was the minimum ultrasonic reading?",
                    "expectedValue": 0.35,
                    "unit": "m",
                    "tolerance": {"mode": "absolute", "value": 0.1},
                    "validRange": {"minimum": 0, "maximum": 4},
                    "feedbackCorrect": "That value is within 0.1 m of the expected observation.",
                    "feedbackIncorrect": "Read the lowest point on the chart and keep the answer in metres.",
                },
                {
                    "key": "dev-ultrasonic-reflection",
                    "type": "short_reflection",
                    "version": 1,
                    "required": False,
                    "prompt": "Describe how the live reading changed during the run.",
                    "collectResponse": True,
                },
            ],
            completion_policy="hybrid",
            start_mode="fresh",
            editor_type="none",
            starter_content=None,
            simulator_settings={"showSimulator": True, "showRemoteControls": True},
            stage_source_type="default",
            stage_title="Maze",
            stage_url="/js-simulator/stages/stage_maze.json",
        ),
        Lesson(
            lesson_key="dev-hidden-sensor-evidence",
            course_id=course_id,
            title="Use hidden helpers and several sensors",
            position=start_position + 2,
            activities=rich_text_activity(
                "dev-hidden-intro",
                "Sensor helper graphics are hidden in this lesson, but the configured notebook evidence remains available.",
                "Reset the run to compare the current compact summary with the previous attempt.",
            )
            + [
                {
                    "key": "dev-hidden-run",
                    "type": "simulator_observation",
                    "version": 1,
                    "required": True,
                    "prompt": "Move, turn, and compare proximity, floor, odometer, and acceleration readings.",
                    "allowedSensors": [
                        "ir-front-left",
                        "ir-front-right",
                        "ir-side-left",
                        "ir-side-right",
                        "ir-floor-left",
                        "ir-floor-center",
                        "ir-floor-right",
                        "odometer-left",
                        "odometer-right",
                        "accelerometer-x",
                    ],
                    "sensorHelperMode": "hidden",
                    "presentations": ["live", "chart", "summary"],
                    "capturedStatistics": [
                        "minimum",
                        "maximum",
                        "average",
                        "finalValue",
                    ],
                    "visibleStatistics": [
                        "minimum",
                        "maximum",
                        "average",
                        "finalValue",
                    ],
                },
                {
                    "key": "dev-hidden-select",
                    "type": "multiple_select",
                    "version": 1,
                    "required": True,
                    "prompt": "Which readings accumulate wheel travel?",
                    "options": [
                        {"key": "left", "label": "Left odometer"},
                        {"key": "right", "label": "Right odometer"},
                        {"key": "floor", "label": "Centre floor sensor"},
                    ],
                    "correctOptionKeys": ["left", "right"],
                    "feedbackCorrect": "Correct. Both odometers accumulate wheel travel.",
                    "feedbackIncorrect": "Select the two wheel-distance readings.",
                },
                {
                    "key": "dev-hidden-percentage",
                    "type": "numeric_answer",
                    "version": 1,
                    "required": False,
                    "prompt": "Enter a measured wheel distance near 1 metre.",
                    "expectedValue": 1,
                    "unit": "m",
                    "tolerance": {"mode": "percentage", "value": 15},
                    "validRange": {"minimum": 0, "maximum": 5},
                    "feedbackCorrect": "The reading is within 15% of one metre.",
                    "feedbackIncorrect": "Use a displayed odometer statistic and keep the answer in metres.",
                },
            ],
            completion_policy="activity",
            start_mode="fresh",
            editor_type="none",
            starter_content=None,
            simulator_settings={"showSimulator": True, "showRemoteControls": True},
            stage_source_type="default",
            stage_title="White field",
            stage_url="/js-simulator/stages/stage_white_rect.json",
        ),
        Lesson(
            lesson_key="dev-always-visible-review",
            course_id=course_id,
            title="Review light and sound evidence",
            position=start_position + 3,
            activities=rich_text_activity(
                "dev-review-intro",
                "This final no-code example keeps sensor helpers visible and collects a reflection for later teacher review.",
            )
            + [
                {
                    "key": "dev-review-run",
                    "type": "simulator_observation",
                    "version": 1,
                    "required": False,
                    "prompt": "Change the light control and observe the light, sound, acceleration, and gyroscope channels.",
                    "allowedSensors": [
                        "ldr-top",
                        "microphone",
                        "accelerometer-y",
                        "accelerometer-z",
                        "gyroscope-x",
                        "gyroscope-y",
                        "gyroscope-z",
                    ],
                    "sensorHelperMode": "always_visible",
                    "presentations": ["live", "summary"],
                    "capturedStatistics": [
                        "minimum",
                        "maximum",
                        "average",
                        "finalValue",
                    ],
                    "visibleStatistics": [
                        "minimum",
                        "maximum",
                        "average",
                        "finalValue",
                    ],
                },
                {
                    "key": "dev-review-reflection",
                    "type": "short_reflection",
                    "version": 1,
                    "required": True,
                    "prompt": "Which sensor changed most clearly, and what evidence supports your answer?",
                    "collectResponse": True,
                },
                {
                    "key": "dev-review-hint",
                    "type": "hint",
                    "version": 1,
                    "required": False,
                    "forActivityKey": "dev-review-run",
                    "content": "Compare the minimum, maximum, and final values rather than relying on colour alone.",
                },
            ],
            completion_policy="teacher_review",
            start_mode="fresh",
            editor_type="none",
            starter_content=None,
            simulator_settings={"showSimulator": True, "showRemoteControls": True},
            stage_source_type="default",
            stage_title="White field",
            stage_url="/js-simulator/stages/stage_white_rect.json",
        ),
    ]


def add_missing_phase_five_lessons(db: Session, course: Course) -> int:
    existing_lessons = db.query(Lesson).filter(Lesson.course_id == course.id).all()
    existing_keys = {lesson.lesson_key for lesson in existing_lessons}
    next_position = (
        max(
            (lesson.position for lesson in existing_lessons if lesson.position > 0),
            default=0,
        )
        + 1
    )
    added = 0
    for lesson in phase_five_sample_lessons(course.id, next_position):
        if lesson.lesson_key in existing_keys:
            continue
        lesson.position = next_position + added
        db.add(lesson)
        added += 1
    return added


def seed_dev_sample_course(db: Session, admin_username: str) -> Course:
    """Create or extend the editable education sample without replacing developer changes."""
    admin = (
        db.query(User)
        .filter(User.username == admin_username, User.role == UserRole.ADMIN)
        .first()
    )
    if admin is None:
        raise RuntimeError(
            f"Development course seed requires admin user {admin_username!r}"
        )

    existing = next(
        (
            course
            for course in db.query(Course).filter(Course.author_id == admin.id).all()
            if DEV_SAMPLE_TAG in (course.tags or [])
        ),
        None,
    )
    if existing:
        added = add_missing_phase_five_lessons(db, existing)
        if DEV_SAMPLE_PHASE_5_TAG not in (existing.tags or []):
            existing.tags = [*(existing.tags or []), DEV_SAMPLE_PHASE_5_TAG]
        if (
            existing.description
            == "A compact development course for exercising the Phase 2 teacher authoring workflow."
        ):
            existing.description = "A development course covering education authoring, activities, completion policies, and simulator sensor observations."
        if existing.learning_objectives == [
            "Author structured lesson instructions",
            "Configure reproducible starter code and simulator stages",
            "Test fresh and inherited lesson workspaces",
        ]:
            existing.learning_objectives = [
                *existing.learning_objectives,
                "Author graded questions, reflections, and hints",
                "Build no-code sensor observations with compact run summaries",
            ]
        if existing.estimated_duration_minutes == 25:
            existing.estimated_duration_minutes = 70
        if existing.status == "archived":
            existing.status = "draft"
        db.commit()
        db.refresh(existing)
        logger.info(
            "Development education sample ready (%s Phase 5 lessons added)", added
        )
        return existing

    course = Course(
        title="Education authoring playground",
        description="A development course covering education authoring, activities, completion policies, and simulator sensor observations.",
        author_id=admin.id,
        learning_objectives=[
            "Author structured lesson instructions",
            "Configure reproducible starter code and simulator stages",
            "Test fresh and inherited lesson workspaces",
            "Author graded questions, reflections, and hints",
            "Build no-code sensor observations with compact run summaries",
        ],
        status="draft",
        visibility="unlisted",
        age_range="10–16",
        difficulty="Beginner",
        estimated_duration_minutes=70,
        prerequisites="No prior robotics experience required.",
        tags=[DEV_SAMPLE_TAG, DEV_SAMPLE_PHASE_5_TAG, "education", "development"],
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
    lessons.extend(phase_five_sample_lessons(course.id, len(lessons) + 1))
    db.add_all(lessons)
    db.commit()
    db.refresh(course)
    logger.info(
        "Development education sample created for admin user %s", admin_username
    )
    return course


def seed_dev_data(db: Session, admin_username: str, test_user_password: str) -> Course:
    seed_dev_test_users(db, test_user_password)
    return seed_dev_sample_course(db, admin_username)
