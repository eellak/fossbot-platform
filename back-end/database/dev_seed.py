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
DEV_SAMPLE_PHASE_6_TAG = "education-phase-6"


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


def phase_six_sample_lessons(course_id: int, start_position: int = 8) -> list[Lesson]:
    """Return evaluation lessons covering every Phase 6 mission primitive and lifecycle."""
    stage = {
        "stage_source_type": "default",
        "stage_title": "Phase 6 mission lab",
        "stage_url": "/js-simulator/stages/stage_missions_phase6.json",
    }
    return [
        Lesson(
            lesson_key="dev-mission-route",
            course_id=course_id,
            title="Complete an ordered mission route",
            position=start_position,
            activities=rich_text_activity(
                "dev-mission-route-intro",
                "Inspect the mission card before running: it combines an ordered checkpoint sequence, a finish target, and time and movement limits.",
                "Try the checkpoints out of order once, then retry. Confirm immediate objective feedback, preserved code, the attempt counter, and the final metrics summary.",
            )
            + [
                {
                    "key": "dev-mission-route-rules",
                    "type": "mission",
                    "version": 1,
                    "required": True,
                    "title": "Blue route challenge",
                    "completionMode": "all",
                    "objectives": [
                        {
                            "key": "ordered-checkpoints",
                            "role": "completion",
                            "summary": "Visit checkpoint one, then checkpoint two.",
                            "condition": {
                                "type": "checkpoints",
                                "markerIds": ["checkpoint-one", "checkpoint-two"],
                                "ordered": True,
                            },
                        },
                        {
                            "key": "reach-route-finish",
                            "role": "completion",
                            "summary": "Reach the green route finish.",
                            "condition": {"type": "reach_target", "markerId": "route-finish"},
                        },
                        {
                            "key": "route-limits",
                            "role": "failure",
                            "summary": "Finish within 60 seconds and 12 movement actions.",
                            "condition": {
                                "type": "limits",
                                "maxDurationMs": 60_000,
                                "maxMovementActions": 12,
                            },
                        },
                    ],
                    "retryLimit": 3,
                    "feedbackMode": "immediate",
                }
            ],
            completion_policy="activity",
            start_mode="fresh",
            editor_type="python",
            starter_content=(
                "# Follow the black guide through both blue checkpoints.\n"
                "for step in range(3):\n"
                "    move_step('forward')\n"
            ),
            simulator_settings={"showSimulator": True},
            **stage,
        ),
        Lesson(
            lesson_key="dev-mission-collect",
            course_id=course_id,
            title="Collect safely with remote controls",
            position=start_position + 1,
            activities=rich_text_activity(
                "dev-mission-collect-intro",
                "Use the no-code movement controls to collect both tokens without entering the red danger zone.",
                "Cause a zone failure or collision on one attempt, then reset and retry. Compare completion, failure, and optional objective states.",
            )
            + [
                {
                    "key": "dev-mission-collect-rules",
                    "type": "mission",
                    "version": 1,
                    "required": True,
                    "title": "Safe collection challenge",
                    "completionMode": "all",
                    "objectives": [
                        {
                            "key": "collect-both",
                            "role": "completion",
                            "summary": "Collect the yellow and orange tokens.",
                            "condition": {
                                "type": "collect",
                                "markerIds": ["collectible-alpha", "collectible-beta"],
                                "requiredCount": 2,
                            },
                        },
                        {
                            "key": "avoid-red-zone",
                            "role": "failure",
                            "summary": "Do not enter the red danger zone.",
                            "condition": {"type": "avoid_zones", "markerIds": ["danger-zone"]},
                        },
                        {
                            "key": "clean-run",
                            "role": "optional",
                            "summary": "Avoid collisions, falls, and runtime errors.",
                            "condition": {
                                "type": "no_incident",
                                "incidents": ["collision", "fall", "runtime_error"],
                            },
                        },
                    ],
                    "retryLimit": 2,
                    "feedbackMode": "immediate",
                }
            ],
            completion_policy="activity",
            start_mode="fresh",
            editor_type="none",
            starter_content=None,
            simulator_settings={"showSimulator": True, "showRemoteControls": True},
            **stage,
        ),
        Lesson(
            lesson_key="dev-mission-push-stop",
            course_id=course_id,
            title="Push an object and stop precisely",
            position=start_position + 2,
            activities=rich_text_activity(
                "dev-mission-push-intro",
                "Push the orange crate fully into its green target zone, then finish the program while the robot is inside the purple stop target.",
                "Confirm that merely crossing the stop target is insufficient and that collision, fall, and runtime-error incidents fail the clean-run objective.",
            )
            + [
                {
                    "key": "dev-mission-push-rules",
                    "type": "mission",
                    "version": 1,
                    "required": True,
                    "title": "Delivery and parking challenge",
                    "completionMode": "all",
                    "objectives": [
                        {
                            "key": "deliver-crate",
                            "role": "completion",
                            "summary": "Move the push crate into the object target zone.",
                            "condition": {
                                "type": "object_in_zone",
                                "objectId": "push-crate",
                                "zoneId": "crate-zone",
                            },
                        },
                        {
                            "key": "park-in-target",
                            "role": "completion",
                            "summary": "Stop in the purple precision target.",
                            "condition": {"type": "stop_in_target", "markerId": "precision-stop"},
                        },
                        {
                            "key": "no-delivery-incident",
                            "role": "failure",
                            "summary": "Complete the attempt without an incident.",
                            "condition": {
                                "type": "no_incident",
                                "incidents": ["collision", "fall", "runtime_error"],
                            },
                        },
                    ],
                    "retryLimit": None,
                    "feedbackMode": "after_attempt",
                }
            ],
            completion_policy="activity",
            start_mode="fresh",
            editor_type="python",
            starter_content=(
                "# Plan a route to push the crate into the green zone, then park.\n"
                "move_step('forward')\n"
            ),
            simulator_settings={"showSimulator": True},
            **stage,
        ),
        Lesson(
            lesson_key="dev-mission-sensor-actuator",
            course_id=course_id,
            title="Evaluate sensors and actuators",
            position=start_position + 3,
            activities=rich_text_activity(
                "dev-mission-sensor-intro",
                "Approach the grey wall until the minimum front-ultrasonic reading is at most one metre, set the LED to green, and sound the buzzer.",
                "Confirm sensor evidence is finalized when the program ends and that the summary reports elapsed time, path distance, actions, incidents, collectibles, and sensor statistics.",
            )
            + [
                {
                    "key": "dev-mission-sensor-rules",
                    "type": "mission",
                    "version": 1,
                    "required": True,
                    "title": "Sense and signal challenge",
                    "completionMode": "all",
                    "objectives": [
                        {
                            "key": "sense-wall",
                            "role": "completion",
                            "summary": "Record a minimum front distance of 1 m or less.",
                            "condition": {
                                "type": "sensor_threshold",
                                "sensorId": "ultrasonic-front",
                                "statistic": "minimum",
                                "operator": "lte",
                                "threshold": 1,
                            },
                        },
                        {
                            "key": "green-led",
                            "role": "completion",
                            "summary": "Set the RGB LED to green.",
                            "condition": {"type": "actuator_state", "actuator": "led", "state": "green"},
                        },
                        {
                            "key": "sound-buzzer",
                            "role": "optional",
                            "summary": "Sound the buzzer during the run.",
                            "condition": {"type": "actuator_state", "actuator": "buzzer", "state": "on"},
                        },
                    ],
                    "retryLimit": 2,
                    "feedbackMode": "after_attempt",
                }
            ],
            completion_policy="activity",
            start_mode="fresh",
            editor_type="python",
            starter_content=(
                "rgb_set_color('green')\n"
                "buzzer_beep(440, 300)\n"
                "for step in range(8):\n"
                "    move_step('forward')\n"
            ),
            simulator_settings={"showSimulator": True},
            **stage,
        ),
        Lesson(
            lesson_key="dev-mission-lifecycle",
            course_id=course_id,
            title="Audit attempts, retries, and preview",
            position=start_position + 4,
            activities=rich_text_activity(
                "dev-mission-lifecycle-intro",
                "This non-gating mission succeeds by reaching the finish or collecting either token. Use it to check any-mode composition and self-completion.",
                "Run success, timeout, reset, manual stop, runtime-error, fall, and navigation-away cases. Verify one terminal attempt per start, preserved code on retry, no duplicate saves, and no persisted attempt from teacher preview.",
                "In the teacher editor, inspect the mission summary and marker picker: every stable mission-lab marker should be discoverable, including the cyan sensor region.",
            )
            + [
                {
                    "key": "dev-mission-lifecycle-rules",
                    "type": "mission",
                    "version": 1,
                    "required": False,
                    "title": "Attempt lifecycle audit",
                    "completionMode": "any",
                    "objectives": [
                        {
                            "key": "quick-finish",
                            "role": "completion",
                            "summary": "Reach the route finish.",
                            "condition": {"type": "reach_target", "markerId": "route-finish"},
                        },
                        {
                            "key": "quick-collect",
                            "role": "completion",
                            "summary": "Collect either token.",
                            "condition": {
                                "type": "collect",
                                "markerIds": ["collectible-alpha", "collectible-beta"],
                                "requiredCount": 1,
                            },
                        },
                        {
                            "key": "audit-danger-zone",
                            "role": "failure",
                            "summary": "Do not enter the danger zone.",
                            "condition": {"type": "avoid_zones", "markerIds": ["danger-zone"]},
                        },
                        {
                            "key": "audit-limits",
                            "role": "failure",
                            "summary": "Finish within 15 seconds and four movement actions.",
                            "condition": {
                                "type": "limits",
                                "maxDurationMs": 15_000,
                                "maxMovementActions": 4,
                            },
                        },
                    ],
                    "retryLimit": 1,
                    "feedbackMode": "after_attempt",
                }
            ],
            completion_policy="self",
            start_mode="fresh",
            editor_type="python",
            starter_content=(
                "# Change this program to exercise each terminal attempt path.\n"
                "move_step('forward')\n"
            ),
            simulator_settings={"showSimulator": True},
            **stage,
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


def add_missing_phase_six_lessons(db: Session, course: Course) -> int:
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
    for lesson in phase_six_sample_lessons(course.id, next_position):
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
        phase_five_added = add_missing_phase_five_lessons(db, existing)
        phase_six_added = add_missing_phase_six_lessons(db, existing)
        if DEV_SAMPLE_PHASE_5_TAG not in (existing.tags or []):
            existing.tags = [*(existing.tags or []), DEV_SAMPLE_PHASE_5_TAG]
        if DEV_SAMPLE_PHASE_6_TAG not in (existing.tags or []):
            existing.tags = [*(existing.tags or []), DEV_SAMPLE_PHASE_6_TAG]
        if (
            existing.description
            in {
                "A compact development course for exercising the Phase 2 teacher authoring workflow.",
                "A development course covering education authoring, activities, completion policies, and simulator sensor observations.",
            }
        ):
            existing.description = "A development course covering education authoring, activities, sensor observations, and simulator mission evaluation."
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
        if existing.learning_objectives == [
            "Author structured lesson instructions",
            "Configure reproducible starter code and simulator stages",
            "Test fresh and inherited lesson workspaces",
            "Author graded questions, reflections, and hints",
            "Build no-code sensor observations with compact run summaries",
        ]:
            existing.learning_objectives = [
                *existing.learning_objectives,
                "Compose simulator missions from safe declarative rules",
                "Evaluate mission retries, feedback, evidence, and lifecycle outcomes",
            ]
        if existing.estimated_duration_minutes == 25:
            existing.estimated_duration_minutes = 70
        if existing.estimated_duration_minutes == 70:
            existing.estimated_duration_minutes = 125
        if existing.status == "archived":
            existing.status = "draft"
        db.commit()
        db.refresh(existing)
        logger.info(
            "Development education sample ready (%s Phase 5 and %s Phase 6 lessons added)",
            phase_five_added,
            phase_six_added,
        )
        return existing

    course = Course(
        title="Education authoring playground",
        description="A development course covering education authoring, activities, sensor observations, and simulator mission evaluation.",
        author_id=admin.id,
        learning_objectives=[
            "Author structured lesson instructions",
            "Configure reproducible starter code and simulator stages",
            "Test fresh and inherited lesson workspaces",
            "Author graded questions, reflections, and hints",
            "Build no-code sensor observations with compact run summaries",
            "Compose simulator missions from safe declarative rules",
            "Evaluate mission retries, feedback, evidence, and lifecycle outcomes",
        ],
        status="draft",
        visibility="unlisted",
        age_range="10–16",
        difficulty="Beginner",
        estimated_duration_minutes=125,
        prerequisites="No prior robotics experience required.",
        tags=[
            DEV_SAMPLE_TAG,
            DEV_SAMPLE_PHASE_5_TAG,
            DEV_SAMPLE_PHASE_6_TAG,
            "education",
            "development",
        ],
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
    lessons.extend(phase_six_sample_lessons(course.id, len(lessons) + 1))
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
