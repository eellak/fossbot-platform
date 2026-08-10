from __future__ import annotations

import logging
import os

from models.models import UserRole
from sqlalchemy.orm import Session
from utils.utils_hash import get_hashed

from database.database import (
    AIInstanceSettings,
    AIPolicyRule,
    AIProviderConfig,
    Course,
    Lesson,
    MarketplaceRoleAssignment,
    User,
)
from utils.ai.capabilities import CAPABILITIES, CAPABILITY_REGISTRY_VERSION

logger = logging.getLogger("uvicorn")
DEV_SAMPLE_TAG = "dev-education-sample"
DEV_TEST_USERS = (
    {
        "username": "dev_admin",
        "firstname": "Dev",
        "lastname": "Admin",
        "email": "dev.admin@fossbot.test",
        "role": UserRole.ADMIN,
        "beta_tester": True,
    },
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
DEV_SAMPLE_LESSONS_TAG = "education-lessons-sample"
DEV_SAMPLE_MISSIONS_TAG = "education-missions-sample"
EDUCATION_EXAMPLE_TAG = "education-examples"
DEV_AI_PROVIDER_NAME = "FOSSBot deterministic test provider"


def seed_dev_ai_data(db: Session, admin_username: str) -> AIProviderConfig | None:
    if (
        os.getenv("ENVIRONMENT", "development").lower() in {"production", "prod"}
        or os.getenv("AI_ENABLE_TEST_PROVIDER", "false").lower() not in {"1", "true", "yes"}
    ):
        return None
    admin = db.query(User).filter(User.username == admin_username).first()
    if admin is None:
        raise ValueError("Development AI seed requires an administrator")
    provider = db.query(AIProviderConfig).filter(AIProviderConfig.name == DEV_AI_PROVIDER_NAME).first()
    if provider is None:
        provider = AIProviderConfig(
            name=DEV_AI_PROVIDER_NAME,
            provider_type="openai_compatible",
            runtime="hosted",
            enabled=True,
            model="fossbot-test",
            base_url="http://localhost:8000/api/ai/test/mock/v1",
            settings={"version": "1", "path": "chat/completions", "supportsUsage": True, "allowPrivateNetwork": True, "compatibilityProfile": "llamacpp"},
            request_limit=1_000,
            token_limit=1_000_000,
            created_by_id=admin.id,
            updated_by_id=admin.id,
        )
        db.add(provider)
        db.flush()
    settings = db.query(AIInstanceSettings).filter(AIInstanceSettings.id == 1).first()
    if settings is None:
        settings = AIInstanceSettings(
            id=1,
            enabled=True,
            default_provider_id=provider.id,
            registry_version=CAPABILITY_REGISTRY_VERSION,
            updated_by_id=admin.id,
        )
        db.add(settings)
    for capability in CAPABILITIES:
        existing = db.query(AIPolicyRule).filter(
            AIPolicyRule.scope_type == "instance",
            AIPolicyRule.scope_key == "*",
            AIPolicyRule.capability == capability.id,
        ).first()
        if existing is None:
            db.add(AIPolicyRule(
                scope_type="instance",
                scope_key="*",
                capability=capability.id,
                effect="allow",
                provider_ids=[provider.id],
                runtimes=["hosted"],
                created_by_id=admin.id,
                updated_by_id=admin.id,
            ))
    db.commit()
    db.refresh(provider)
    logger.info("Development AI test provider ready")
    return provider


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


def sample_activity_lessons(course_id: int, start_position: int = 4) -> list[Lesson]:
    """Return focused lessons covering activity authoring and student flow."""
    return [
        Lesson(
            lesson_key="dev-activities-mixed",
            course_id=course_id,
            title="Mix questions, reflection, and hints",
            position=start_position,
            activities=rich_text_activity(
                "dev-mixed-intro",
                "Activity lessons are readable sequences rather than a single instruction block.",
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


def sample_evaluation_lessons(course_id: int, start_position: int = 8) -> list[Lesson]:
    """Return evaluation lessons covering mission primitives and lifecycle."""
    stage = {
        "stage_source_type": "default",
        "stage_title": "Mission lab",
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


def phase_eight_example_definitions() -> list[dict]:
    """Return the three public Phase 8 examples (eight lessons total)."""
    return education_example_definitions()


def education_example_definitions() -> list[dict]:
    """Return the three public education examples (eight lessons total)."""
    mission_stage = {
        "sourceType": "default",
        "title": "Mission challenge field",
        "url": "/js-simulator/stages/stage_missions_phase6.json",
    }
    return [
        {
            "course": {
                "title": "Getting started with FOSSBot",
                "description": "An introductory course for early robotics learners covering foundational concepts and single-step movements.",
                "learning_objectives": ["Identify robot components", "Issue single-movement commands", "Predict robot paths"],
                "visibility": "public",
                "tags": [EDUCATION_EXAMPLE_TAG, "getting-started"],
                "age_range": "8–14",
                "difficulty": "Beginner",
                "estimated_duration_minutes": 45,
                "prerequisites": "No prior programming experience required.",
            },
            "lessons": [
                {
                    "lessonKey": "getting-started-move",
                    "title": "Make your first move",
                    "activities": rich_text_activity(
                        "getting-started-move-intro",
                        "Run the starter program, then change the number of forward steps.",
                        "Reset simulation returns the robot to the starting position without deleting your code.",
                    ),
                    "completion_policy": "self",
                    "editor_type": "python",
                    "starter_content": "move_step('forward')\nturn_left(90)\n",
                    "simulator_settings": {"showSimulator": True},
                    "stageReference": {"sourceType": "default", "title": "White field", "url": "/js-simulator/stages/stage_white_rect.json"},
                },
                {
                    "lessonKey": "getting-started-loop",
                    "title": "Repeat with a loop",
                    "activities": rich_text_activity(
                        "getting-started-loop-intro",
                        "Start with the previous lesson's saved code, then replace repeated movement commands with a loop.",
                    ),
                    "completion_policy": "self",
                    "start_mode": "inherit_previous_code",
                    "editor_type": "python",
                    "simulator_settings": {"showSimulator": True},
                    "stageReference": {"sourceType": "default", "title": "White field", "url": "/js-simulator/stages/stage_white_rect.json"},
                },
                {
                    "lessonKey": "getting-started-distance",
                    "title": "Watch distance change",
                    "activities": rich_text_activity(
                        "getting-started-distance-intro",
                        "Use the movement controls to approach the wall. Watch how the front distance changes; no code is required.",
                    ) + [
                        {
                            "key": "getting-started-distance-run",
                            "type": "simulator_observation",
                            "version": 1,
                            "required": True,
                            "prompt": "Move toward the wall and record a sensor run.",
                            "allowedSensors": ["ultrasonic-front"],
                            "sensorHelperMode": "student_toggle",
                            "presentations": ["live", "chart", "summary"],
                            "capturedStatistics": ["minimum", "maximum", "average", "finalValue"],
                            "visibleStatistics": ["minimum", "maximum", "average", "finalValue"],
                        },
                        {
                            "key": "getting-started-distance-answer",
                            "type": "multiple_choice",
                            "version": 1,
                            "required": True,
                            "prompt": "What happens to the front distance as the robot approaches the wall?",
                            "options": [{"key": "smaller", "label": "It gets smaller"}, {"key": "larger", "label": "It gets larger"}],
                            "correctOptionKey": "smaller",
                            "feedbackCorrect": "Correct. A nearby wall gives a smaller distance.",
                            "feedbackIncorrect": "Try another run and compare the first and final readings.",
                        },
                    ],
                    "completion_policy": "hybrid",
                    "editor_type": "none",
                    "simulator_settings": {"showSimulator": True, "showRemoteControls": True},
                    "stageReference": {"sourceType": "default", "title": "Maze", "url": "/js-simulator/stages/stage_maze.json"},
                },
            ],
        },
        {
            "course": {
                "title": "Obstacle Navigation",
                "description": "Use collisions, ultrasonic sensing, and checkpoints to plan safe routes.",
                "learning_objectives": ["Explain safe obstacle detection", "Navigate checkpoints", "Design a wall-following strategy"],
                "visibility": "public",
                "tags": [EDUCATION_EXAMPLE_TAG, "navigation"],
            },
            "lessons": [
                {
                    "lessonKey": "obstacle-collision-reading",
                    "title": "Plan before contact",
                    "activities": rich_text_activity(
                        "obstacle-collision-reading-content",
                        "A distance sensor lets a robot react before a collision. Read the route and decide where the robot should slow down.",
                        "This reading lesson has no code and no stage. Mark it finished when your route plan is ready.",
                    ),
                    "completion_policy": "self",
                    "editor_type": "none",
                    "simulator_settings": {"showSimulator": False},
                },
                {
                    "lessonKey": "obstacle-checkpoint-mission",
                    "title": "Navigate checkpoints",
                    "activities": rich_text_activity(
                        "obstacle-checkpoint-intro",
                        "The robot starts at Spawn. Visit both checkpoints in order, then reach the Target.",
                    ) + [{
                        "key": "obstacle-checkpoint-rules",
                        "type": "mission",
                        "version": 1,
                        "required": True,
                        "title": "Checkpoint route",
                        "completionMode": "all",
                        "objectives": [
                            {"key": "route-checkpoints", "role": "completion", "summary": "Visit both checkpoints in order.", "condition": {"type": "checkpoints", "markerIds": ["checkpoint-one", "checkpoint-two"], "ordered": True}},
                            {"key": "route-target", "role": "completion", "summary": "Reach the route target.", "condition": {"type": "reach_target", "markerId": "route-finish"}},
                            {"key": "route-safety", "role": "failure", "summary": "Finish without a collision, fall, or runtime error.", "condition": {"type": "no_incident", "incidents": ["collision", "fall", "runtime_error"]}},
                        ],
                        "retryLimit": None,
                        "feedbackMode": "immediate",
                    }],
                    "completion_policy": "activity",
                    "editor_type": "python",
                    "starter_content": "# Visit both checkpoints, then the target.\nmove_step('forward')\n",
                    "simulator_settings": {"showSimulator": True},
                    "stageReference": mission_stage,
                },
                {
                    "lessonKey": "obstacle-wall-following",
                    "title": "Build a wall follower",
                    "activities": rich_text_activity(
                        "obstacle-wall-following-content",
                        "Start fresh. Read the front and side distances, then choose whether to move or turn.",
                        "There is more than one good solution; explain your stopping rule before marking the lesson finished.",
                    ),
                    "completion_policy": "self",
                    "start_mode": "fresh",
                    "editor_type": "python",
                    "starter_content": "# Start a new wall-following strategy here.\n",
                    "simulator_settings": {"showSimulator": True},
                    "stageReference": {"sourceType": "default", "title": "Maze", "url": "/js-simulator/stages/stage_maze.json"},
                },
            ],
        },
        {
            "course": {
                "title": "Advanced Challenges",
                "description": "Combine sensor evidence with open-ended simulator challenges.",
                "learning_objectives": ["Combine several sensor signals", "Optimize a successful mission without making score a completion barrier"],
                "visibility": "public",
                "tags": [EDUCATION_EXAMPLE_TAG, "advanced"],
            },
            "lessons": [
                {
                    "lessonKey": "advanced-multi-sensor",
                    "title": "Compare several sensors",
                    "activities": rich_text_activity(
                        "advanced-multi-sensor-intro",
                        "Run the robot and compare distance, floor, and odometer summaries. Use the text summary as an alternative to the chart.",
                    ) + [{
                        "key": "advanced-multi-sensor-run",
                        "type": "simulator_observation",
                        "version": 1,
                        "required": True,
                        "prompt": "Record a run and identify which sensor best supports your route decision.",
                        "allowedSensors": ["ultrasonic-front", "ir-floor-center", "odometer-left", "odometer-right"],
                        "sensorHelperMode": "always_visible",
                        "presentations": ["live", "chart", "summary"],
                        "capturedStatistics": ["minimum", "maximum", "average", "finalValue"],
                        "visibleStatistics": ["minimum", "maximum", "average", "finalValue"],
                    }],
                    "completion_policy": "activity",
                    "editor_type": "none",
                    "simulator_settings": {"showSimulator": True, "showRemoteControls": True},
                    "stageReference": {"sourceType": "default", "title": "White field", "url": "/js-simulator/stages/stage_white_rect.json"},
                },
                {
                    "lessonKey": "advanced-efficient-route",
                    "title": "Find an efficient route",
                    "activities": rich_text_activity(
                        "advanced-efficient-route-intro",
                        "First complete the route. Then, if you want, improve movement actions and path distance as separate measures.",
                    ) + [{
                        "key": "advanced-efficient-route-rules",
                        "type": "mission",
                        "version": 1,
                        "required": True,
                        "title": "Efficient route challenge",
                        "completionMode": "all",
                        "objectives": [
                            {"key": "advanced-route-target", "role": "completion", "summary": "Reach the route target.", "condition": {"type": "reach_target", "markerId": "route-finish"}},
                            {"key": "advanced-route-clean", "role": "optional", "summary": "Avoid collisions, falls, and runtime errors.", "condition": {"type": "no_incident", "incidents": ["collision", "fall", "runtime_error"]}},
                        ],
                        "retryLimit": None,
                        "feedbackMode": "after_attempt",
                        "scoreConfig": {
                            "version": 1,
                            "enabled": True,
                            "rankFailedAttempts": False,
                            "components": [
                                {"key": "finish-points", "label": "Reach the target", "type": "objective", "objectiveKey": "advanced-route-target", "points": 60, "weight": 1},
                                {"key": "move-points", "label": "Movement actions", "type": "movement_efficiency", "points": 20, "target": 8, "tolerance": 8, "weight": 1},
                                {"key": "path-points", "label": "Path distance", "type": "path_efficiency", "points": 20, "target": 4, "tolerance": 4, "weight": 1},
                            ],
                            "starThresholds": [0.5, 0.75, 0.9],
                        },
                    }],
                    "completion_policy": "activity",
                    "editor_type": "python",
                    "starter_content": "# Reach the target first; optimize only after success.\nmove_step('forward')\n",
                    "simulator_settings": {"showSimulator": True},
                    "stageReference": mission_stage,
                },
            ],
        },
    ]


def seed_education_example_courses(db: Session, teacher_username: str = "dev_teacher") -> list[Course]:
    """Create and publish the examples through canonical course API functions."""
    from routers.courses import CourseCreate, LessonCreate, add_lesson, create_course, publish_course

    teacher = db.query(User).filter(User.username == teacher_username, User.role == UserRole.TUTOR).first()
    if teacher is None:
        raise RuntimeError(f"Education example seed requires tutor user {teacher_username!r}")

    examples: list[Course] = []
    for definition in education_example_definitions():
        existing = next(
            (course for course in db.query(Course).filter(Course.author_id == teacher.id).all() if EDUCATION_EXAMPLE_TAG in (course.tags or []) and course.title == definition["course"]["title"]),
            None,
        )
        if existing:
            examples.append(existing)
            continue
        created = create_course(CourseCreate.model_validate(definition["course"]), teacher, db)
        for lesson in definition["lessons"]:
            add_lesson(created["id"], LessonCreate.model_validate(lesson), teacher, db)
        publish_course(created["id"], teacher, db)
        examples.append(db.query(Course).filter(Course.id == created["id"]).one())
    logger.info("Education examples ready: %s", ", ".join(str(course.id) for course in examples))
    return examples


def add_missing_activity_lessons(db: Session, course: Course) -> int:
    existing_lessons = db.query(Lesson).filter(Lesson.course_id == course.id).all()
    existing_keys = {lesson.lesson_key for lesson in existing_lessons}
    next_position = max((lesson.position for lesson in existing_lessons), default=0) + 1
    added = 0
    for lesson in sample_activity_lessons(course.id, next_position):
        if lesson.lesson_key not in existing_keys:
            db.add(lesson)
            added += 1
            next_position += 1
    return added


def add_missing_evaluation_lessons(db: Session, course: Course) -> int:
    existing_lessons = db.query(Lesson).filter(Lesson.course_id == course.id).all()
    existing_keys = {lesson.lesson_key for lesson in existing_lessons}
    next_position = max((lesson.position for lesson in existing_lessons), default=0) + 1
    added = 0
    for lesson in sample_evaluation_lessons(course.id, next_position):
        if lesson.lesson_key not in existing_keys:
            db.add(lesson)
            added += 1
            next_position += 1
    return added


def seed_dev_education_data(db: Session, admin_username: str) -> Course:
    return seed_dev_sample_course(db, admin_username)


def seed_dev_sample_course(db: Session, admin_username: str) -> Course:
    admin = db.query(User).filter(User.username == admin_username).first()
    if admin is None:
        raise RuntimeError(f"Development education seed requires user {admin_username!r}")

    existing = next(
        (course for course in db.query(Course).filter(Course.author_id == admin.id).all() if DEV_SAMPLE_TAG in (course.tags or [])),
        None,
    )
    if existing:
        phase_five_added = add_missing_activity_lessons(db, existing)
        phase_six_added = add_missing_evaluation_lessons(db, existing)
        if DEV_SAMPLE_LESSONS_TAG not in (existing.tags or []):
            existing.tags = [*(existing.tags or []), DEV_SAMPLE_LESSONS_TAG]
        if DEV_SAMPLE_MISSIONS_TAG not in (existing.tags or []):
            existing.tags = [*(existing.tags or []), DEV_SAMPLE_MISSIONS_TAG]
        if (
            existing.description
            in {
                "A compact development course for exercising the teacher authoring workflow.",
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
            "Development education sample ready (%s activity and %s evaluation lessons added)",
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
            DEV_SAMPLE_LESSONS_TAG,
            DEV_SAMPLE_MISSIONS_TAG,
            "education",
            "development",
        ],
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    lessons: list[Lesson] = [
        Lesson(
            lesson_key="dev-intro",
            course_id=course.id,
            title="Introduction to FOSSBot concepts",
            position=1,
            activities=[],
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
    lessons.extend(sample_activity_lessons(course.id, len(lessons) + 1))
    lessons.extend(sample_evaluation_lessons(course.id, len(lessons) + 1))
    db.add_all(lessons)
    db.commit()
    db.refresh(course)
    logger.info(
        "Development education sample created for admin user %s", admin_username
    )
    return course


def seed_dev_data(db: Session, admin_username: str, test_user_password: str) -> Course:
    seed_dev_test_users(db, test_user_password)
    seed_dev_ai_data(db, admin_username)
    sample = seed_dev_sample_course(db, admin_username)
    seed_education_example_courses(db)
    return sample
