from __future__ import annotations

import datetime
import secrets
from collections import Counter
from typing import Any, Literal, Optional

from database.database import (
    ActivityAnswer,
    ClassChallenge,
    ClassGroup,
    ClassMembership,
    Course,
    CourseAssignment,
    CourseRelease,
    Enrollment,
    LessonProgress,
    LessonWorkspace,
    MissionAttempt,
    User,
)
from fastapi import APIRouter, Depends, HTTPException, status
from models.models import UserRole
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from routers.stage_sources import get_beta_user, get_current_user, get_db


router = APIRouter(tags=["classrooms"], dependencies=[Depends(get_beta_user)])
BOARD_TYPES = {
    "highest_score",
    "fastest",
    "fewest_movements",
    "shortest_path",
    "most_optional",
}


class GroupCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=120)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return value.strip()


class GroupUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    status: Optional[Literal["active", "archived"]] = None
    leaderboards_enabled: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: Optional[str]) -> Optional[str]:
        return value.strip() if value is not None else None


class JoinGroupRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    join_code: str = Field(min_length=4, max_length=40)


class MembershipUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    display_alias: Optional[str] = Field(default=None, min_length=2, max_length=40)
    leaderboard_opt_in: Optional[bool] = None

    @field_validator("display_alias")
    @classmethod
    def normalize_alias(cls, value: Optional[str]) -> Optional[str]:
        return value.strip() if value is not None else None


class AssignmentCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    course_id: int
    update_policy: Literal["pinned", "student_choice", "latest"] = "student_choice"
    due_at: Optional[datetime.datetime] = None


class AssignmentUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    release_id: Optional[int] = None
    update_policy: Optional[Literal["pinned", "student_choice", "latest"]] = None
    due_at: Optional[datetime.datetime] = None


class ChallengeCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    lesson_key: str = Field(min_length=1, max_length=100)
    activity_key: str = Field(min_length=1, max_length=100)
    board_type: Literal[
        "highest_score", "fastest", "fewest_movements", "shortest_path", "most_optional"
    ] = "highest_score"
    tie_tolerance: float = Field(default=0, ge=0, le=86_400_000)
    enabled: bool = False


class ChallengeUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    board_type: Optional[Literal[
        "highest_score", "fastest", "fewest_movements", "shortest_path", "most_optional"
    ]] = None
    tie_tolerance: Optional[float] = Field(default=None, ge=0, le=86_400_000)
    enabled: Optional[bool] = None


def require_teacher(user: User) -> None:
    if user.role not in (UserRole.TUTOR, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Tutor or administrator role required")


def require_student(user: User) -> None:
    if user.role != UserRole.USER:
        raise HTTPException(status_code=403, detail="Student role required")


def owned_group_or_404(db: Session, user: User, group_id: int) -> ClassGroup:
    group = db.query(ClassGroup).filter(
        ClassGroup.id == group_id,
        ClassGroup.teacher_id == user.id,
    ).first()
    if group is None:
        raise HTTPException(status_code=404, detail="Class group not found")
    return group


def active_membership_or_404(db: Session, user: User, group_id: int) -> ClassMembership:
    membership = db.query(ClassMembership).filter(
        ClassMembership.group_id == group_id,
        ClassMembership.student_id == user.id,
        ClassMembership.removed_at.is_(None),
    ).first()
    if membership is None:
        raise HTTPException(status_code=404, detail="Class group not found")
    return membership


def assignment_or_404(db: Session, assignment_id: int) -> CourseAssignment:
    assignment = db.query(CourseAssignment).filter(CourseAssignment.id == assignment_id).first()
    if assignment is None:
        raise HTTPException(status_code=404, detail="Course assignment not found")
    return assignment


def teacher_assignment_or_404(db: Session, user: User, assignment_id: int) -> tuple[CourseAssignment, ClassGroup]:
    assignment = assignment_or_404(db, assignment_id)
    group = owned_group_or_404(db, user, assignment.group_id)
    return assignment, group


def challenge_or_404(db: Session, challenge_id: int) -> ClassChallenge:
    challenge = db.query(ClassChallenge).filter(ClassChallenge.id == challenge_id).first()
    if challenge is None:
        raise HTTPException(status_code=404, detail="Class challenge not found")
    return challenge


def release_lessons(release: CourseRelease) -> list[dict[str, Any]]:
    return sorted(release.snapshot.get("lessons", []), key=lambda lesson: lesson["position"])


def released_mission(release: CourseRelease, lesson_key: str, activity_key: str) -> tuple[dict[str, Any], dict[str, Any]]:
    lesson = next((item for item in release_lessons(release) if item["lessonKey"] == lesson_key), None)
    if lesson is None:
        raise HTTPException(status_code=422, detail="Lesson is not part of the assigned release")
    activity = next((item for item in lesson.get("activities", []) if item.get("key") == activity_key), None)
    if activity is None or activity.get("type") != "mission":
        raise HTTPException(status_code=422, detail="Challenge must reference a mission in the assigned release")
    return lesson, activity


def new_join_code(db: Session) -> str:
    for _ in range(20):
        code = secrets.token_hex(4).upper()
        if db.query(ClassGroup).filter(ClassGroup.join_code == code).first() is None:
            return code
    raise HTTPException(status_code=503, detail="Could not create a unique join code")


def default_alias() -> str:
    return f"Learner-{secrets.token_hex(2).upper()}"


def ensure_assignment_enrollment(db: Session, assignment: CourseAssignment, student_id: int) -> Enrollment:
    enrollment = db.query(Enrollment).filter(
        Enrollment.student_id == student_id,
        Enrollment.course_id == assignment.course_id,
    ).first()
    if enrollment:
        return enrollment
    enrollment = Enrollment(
        student_id=student_id,
        course_id=assignment.course_id,
        active_release_id=assignment.release_id,
    )
    db.add(enrollment)
    return enrollment


def challenge_payload(db: Session, challenge: ClassChallenge) -> dict[str, Any]:
    release = db.query(CourseRelease).filter(CourseRelease.id == challenge.release_id).one()
    lesson, activity = released_mission(release, challenge.lesson_key, challenge.activity_key)
    return {
        "id": challenge.id,
        "assignment_id": challenge.assignment_id,
        "release_id": challenge.release_id,
        "release_version": release.version,
        "lesson_key": challenge.lesson_key,
        "lesson_title": lesson["title"],
        "activity_key": challenge.activity_key,
        "activity_title": activity["title"],
        "score_enabled": bool((activity.get("scoreConfig") or {}).get("enabled")),
        "enabled": challenge.enabled,
        "board_type": challenge.board_type,
        "tie_tolerance": challenge.tie_tolerance,
        "season": challenge.season,
    }


def assignment_payload(db: Session, assignment: CourseAssignment, season: int) -> dict[str, Any]:
    course = db.query(Course).filter(Course.id == assignment.course_id).one()
    release = db.query(CourseRelease).filter(CourseRelease.id == assignment.release_id).one()
    challenges = db.query(ClassChallenge).filter(
        ClassChallenge.assignment_id == assignment.id,
        ClassChallenge.season == season,
    ).order_by(ClassChallenge.id).all()
    missions = []
    for lesson in release_lessons(release):
        for activity in lesson.get("activities", []):
            if activity.get("type") == "mission":
                missions.append({
                    "lesson_key": lesson["lessonKey"],
                    "lesson_title": lesson["title"],
                    "activity_key": activity["key"],
                    "activity_title": activity["title"],
                    "score_enabled": bool((activity.get("scoreConfig") or {}).get("enabled")),
                })
    return {
        "id": assignment.id,
        "group_id": assignment.group_id,
        "course_id": assignment.course_id,
        "course_title": release.snapshot["course"]["title"],
        "release_id": assignment.release_id,
        "release_version": release.version,
        "latest_release_id": course.latest_published_release_id,
        "update_available": course.latest_published_release_id != assignment.release_id,
        "update_policy": assignment.update_policy,
        "due_at": assignment.due_at,
        "missions": missions,
        "challenges": [challenge_payload(db, item) for item in challenges],
    }


def teacher_group_payload(db: Session, group: ClassGroup) -> dict[str, Any]:
    memberships = db.query(ClassMembership).filter(
        ClassMembership.group_id == group.id,
        ClassMembership.removed_at.is_(None),
    ).order_by(ClassMembership.joined_at).all()
    students = {
        student.id: student
        for student in db.query(User).filter(User.id.in_([item.student_id for item in memberships])).all()
    } if memberships else {}
    assignments = db.query(CourseAssignment).filter(
        CourseAssignment.group_id == group.id,
    ).order_by(CourseAssignment.created_at).all()
    return {
        "id": group.id,
        "name": group.name,
        "status": group.status,
        "join_code": group.join_code,
        "leaderboards_enabled": group.leaderboards_enabled,
        "challenge_season": group.challenge_season,
        "created_at": group.created_at,
        "members": [{
            "id": item.id,
            "student_username": students[item.student_id].username,
            "display_alias": item.display_alias,
            "leaderboard_opt_in": item.leaderboard_opt_in,
            "joined_at": item.joined_at,
        } for item in memberships],
        "assignments": [assignment_payload(db, item, group.challenge_season) for item in assignments],
    }


def student_group_payload(db: Session, membership: ClassMembership) -> dict[str, Any]:
    group = db.query(ClassGroup).filter(ClassGroup.id == membership.group_id).one()
    assignments = db.query(CourseAssignment).filter(
        CourseAssignment.group_id == group.id,
    ).order_by(CourseAssignment.created_at).all()
    return {
        "id": group.id,
        "name": group.name,
        "status": group.status,
        "leaderboards_enabled": group.leaderboards_enabled,
        "challenge_season": group.challenge_season,
        "membership": {
            "display_alias": membership.display_alias,
            "leaderboard_opt_in": membership.leaderboard_opt_in,
            "joined_at": membership.joined_at,
        },
        "assignments": [assignment_payload(db, item, group.challenge_season) for item in assignments],
    }


@router.post("/class-groups", status_code=status.HTTP_201_CREATED)
def create_group(
    request: GroupCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_teacher(user)
    now = datetime.datetime.utcnow()
    group = ClassGroup(
        teacher_id=user.id,
        name=request.name,
        status="active",
        join_code=new_join_code(db),
        leaderboards_enabled=False,
        challenge_season=1,
        created_at=now,
        updated_at=now,
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return teacher_group_payload(db, group)


@router.get("/class-groups/mine")
def list_teacher_groups(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_teacher(user)
    groups = db.query(ClassGroup).filter(
        ClassGroup.teacher_id == user.id,
    ).order_by(ClassGroup.updated_at.desc()).all()
    return [teacher_group_payload(db, group) for group in groups]


@router.put("/class-groups/{group_id}")
def update_group(
    group_id: int,
    request: GroupUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_teacher(user)
    group = owned_group_or_404(db, user, group_id)
    for field, value in request.model_dump(exclude_unset=True).items():
        setattr(group, field, value)
    group.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(group)
    return teacher_group_payload(db, group)


@router.post("/class-groups/{group_id}/join-code")
def regenerate_join_code(
    group_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_teacher(user)
    group = owned_group_or_404(db, user, group_id)
    group.join_code = new_join_code(db)
    group.updated_at = datetime.datetime.utcnow()
    db.commit()
    return teacher_group_payload(db, group)


@router.post("/class-groups/{group_id}/reset-season")
def reset_challenge_season(
    group_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_teacher(user)
    group = owned_group_or_404(db, user, group_id)
    previous = group.challenge_season
    group.challenge_season += 1
    assignments = db.query(CourseAssignment).filter(CourseAssignment.group_id == group.id).all()
    assignment_ids = [item.id for item in assignments]
    challenges = db.query(ClassChallenge).filter(
        ClassChallenge.assignment_id.in_(assignment_ids),
        ClassChallenge.season == previous,
    ).all() if assignment_ids else []
    now = datetime.datetime.utcnow()
    for challenge in challenges:
        assignment = next(item for item in assignments if item.id == challenge.assignment_id)
        release = db.query(CourseRelease).filter(CourseRelease.id == assignment.release_id).one()
        try:
            released_mission(release, challenge.lesson_key, challenge.activity_key)
        except HTTPException:
            continue
        db.add(ClassChallenge(
            assignment_id=assignment.id,
            release_id=assignment.release_id,
            lesson_key=challenge.lesson_key,
            activity_key=challenge.activity_key,
            enabled=challenge.enabled,
            board_type=challenge.board_type,
            tie_tolerance=challenge.tie_tolerance,
            season=group.challenge_season,
            created_at=now,
            updated_at=now,
        ))
    db.commit()
    return teacher_group_payload(db, group)


@router.post("/class-groups/join", status_code=status.HTTP_201_CREATED)
def join_group(
    request: JoinGroupRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_student(user)
    group = db.query(ClassGroup).filter(
        ClassGroup.join_code == request.join_code.strip().upper(),
        ClassGroup.status == "active",
    ).first()
    if group is None:
        raise HTTPException(status_code=404, detail="Join code is not active")
    membership = db.query(ClassMembership).filter(
        ClassMembership.group_id == group.id,
        ClassMembership.student_id == user.id,
    ).first()
    now = datetime.datetime.utcnow()
    if membership:
        membership.removed_at = None
        membership.leaderboard_opt_in = False
        membership.updated_at = now
    else:
        membership = ClassMembership(
            group_id=group.id,
            student_id=user.id,
            display_alias=default_alias(),
            leaderboard_opt_in=False,
            joined_at=now,
            updated_at=now,
        )
        db.add(membership)
    for assignment in db.query(CourseAssignment).filter(CourseAssignment.group_id == group.id).all():
        ensure_assignment_enrollment(db, assignment, user.id)
    db.commit()
    db.refresh(membership)
    return student_group_payload(db, membership)


@router.get("/class-groups/joined")
def list_joined_groups(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_student(user)
    memberships = db.query(ClassMembership).filter(
        ClassMembership.student_id == user.id,
        ClassMembership.removed_at.is_(None),
    ).order_by(ClassMembership.joined_at.desc()).all()
    return [student_group_payload(db, item) for item in memberships]


@router.put("/class-groups/{group_id}/membership")
def update_own_membership(
    group_id: int,
    request: MembershipUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_student(user)
    membership = active_membership_or_404(db, user, group_id)
    for field, value in request.model_dump(exclude_unset=True).items():
        setattr(membership, field, value)
    membership.updated_at = datetime.datetime.utcnow()
    db.commit()
    return student_group_payload(db, membership)


@router.delete("/class-groups/{group_id}/membership", status_code=status.HTTP_204_NO_CONTENT)
def leave_group(
    group_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_student(user)
    membership = active_membership_or_404(db, user, group_id)
    membership.removed_at = datetime.datetime.utcnow()
    membership.leaderboard_opt_in = False
    db.commit()


@router.delete("/class-groups/{group_id}/members/{membership_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    group_id: int,
    membership_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_teacher(user)
    owned_group_or_404(db, user, group_id)
    membership = db.query(ClassMembership).filter(
        ClassMembership.id == membership_id,
        ClassMembership.group_id == group_id,
        ClassMembership.removed_at.is_(None),
    ).first()
    if membership is None:
        raise HTTPException(status_code=404, detail="Class member not found")
    membership.removed_at = datetime.datetime.utcnow()
    membership.leaderboard_opt_in = False
    db.commit()


@router.post("/class-groups/{group_id}/assignments", status_code=status.HTTP_201_CREATED)
def create_assignment(
    group_id: int,
    request: AssignmentCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_teacher(user)
    group = owned_group_or_404(db, user, group_id)
    course = db.query(Course).filter(
        Course.id == request.course_id,
        Course.author_id == user.id,
        Course.latest_published_release_id.is_not(None),
    ).first()
    if course is None:
        raise HTTPException(status_code=404, detail="Published course not found")
    assignment = CourseAssignment(
        group_id=group.id,
        course_id=course.id,
        release_id=course.latest_published_release_id,
        update_policy=request.update_policy,
        due_at=request.due_at.replace(tzinfo=None) if request.due_at else None,
    )
    db.add(assignment)
    try:
        db.flush()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Course is already assigned to this class group") from error
    memberships = db.query(ClassMembership).filter(
        ClassMembership.group_id == group.id,
        ClassMembership.removed_at.is_(None),
    ).all()
    for membership in memberships:
        ensure_assignment_enrollment(db, assignment, membership.student_id)
    db.commit()
    db.refresh(assignment)
    return assignment_payload(db, assignment, group.challenge_season)


@router.put("/course-assignments/{assignment_id}")
def update_assignment(
    assignment_id: int,
    request: AssignmentUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_teacher(user)
    assignment, group = teacher_assignment_or_404(db, user, assignment_id)
    values = request.model_dump(exclude_unset=True)
    release_id = values.pop("release_id", None)
    if release_id is not None:
        release = db.query(CourseRelease).filter(
            CourseRelease.id == release_id,
            CourseRelease.course_id == assignment.course_id,
        ).first()
        if release is None:
            raise HTTPException(status_code=422, detail="Release does not belong to the assigned course")
        assignment.release_id = release.id
    if "due_at" in values and values["due_at"] is not None:
        values["due_at"] = values["due_at"].replace(tzinfo=None)
    for field, value in values.items():
        setattr(assignment, field, value)
    db.commit()
    return assignment_payload(db, assignment, group.challenge_season)


@router.post("/course-assignments/{assignment_id}/challenges", status_code=status.HTTP_201_CREATED)
def create_challenge(
    assignment_id: int,
    request: ChallengeCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_teacher(user)
    assignment, group = teacher_assignment_or_404(db, user, assignment_id)
    release = db.query(CourseRelease).filter(CourseRelease.id == assignment.release_id).one()
    _, activity = released_mission(release, request.lesson_key, request.activity_key)
    if request.board_type == "highest_score" and not (activity.get("scoreConfig") or {}).get("enabled"):
        raise HTTPException(status_code=422, detail="Highest-score challenges require scoring in the assigned release")
    challenge = ClassChallenge(
        assignment_id=assignment.id,
        release_id=release.id,
        lesson_key=request.lesson_key,
        activity_key=request.activity_key,
        enabled=request.enabled,
        board_type=request.board_type,
        tie_tolerance=request.tie_tolerance,
        season=group.challenge_season,
    )
    db.add(challenge)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="This mission already has a challenge for the active season") from error
    db.refresh(challenge)
    return challenge_payload(db, challenge)


@router.put("/class-challenges/{challenge_id}")
def update_challenge(
    challenge_id: int,
    request: ChallengeUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_teacher(user)
    challenge = challenge_or_404(db, challenge_id)
    assignment, _ = teacher_assignment_or_404(db, user, challenge.assignment_id)
    values = request.model_dump(exclude_unset=True)
    board_type = values.get("board_type", challenge.board_type)
    if board_type == "highest_score":
        release = db.query(CourseRelease).filter(CourseRelease.id == challenge.release_id).one()
        _, activity = released_mission(release, challenge.lesson_key, challenge.activity_key)
        if not (activity.get("scoreConfig") or {}).get("enabled"):
            raise HTTPException(status_code=422, detail="Highest-score challenges require scoring in the assigned release")
    for field, value in values.items():
        setattr(challenge, field, value)
    db.commit()
    return challenge_payload(db, challenge)


def leaderboard_value(attempt: MissionAttempt, board_type: str) -> Optional[float]:
    if board_type == "highest_score":
        if not attempt.score_result or not attempt.score_result.get("rank_eligible"):
            return None
        return float(attempt.score_result["total"])
    if board_type == "fastest":
        return float(attempt.metrics["elapsed_ms"])
    if board_type == "fewest_movements":
        return float(attempt.metrics["movement_actions"])
    if board_type == "shortest_path":
        return float(attempt.metrics["path_distance"])
    optional = sum(
        item.get("role") == "optional" and item.get("status") == "succeeded"
        for item in attempt.objective_results
    )
    return float(optional + attempt.metrics.get("collectibles", 0))


@router.get("/class-challenges/{challenge_id}/statistics")
def read_challenge_statistics(
    challenge_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_teacher(user)
    challenge = challenge_or_404(db, challenge_id)
    assignment, group = teacher_assignment_or_404(db, user, challenge.assignment_id)
    memberships = db.query(ClassMembership).filter(
        ClassMembership.group_id == group.id,
        ClassMembership.removed_at.is_(None),
    ).all()
    student_ids = [item.student_id for item in memberships]
    enrollments = db.query(Enrollment).filter(
        Enrollment.student_id.in_(student_ids),
        Enrollment.course_id == assignment.course_id,
    ).all() if student_ids else []
    enrollment_ids = [item.id for item in enrollments]
    attempts = db.query(MissionAttempt).filter(
        MissionAttempt.enrollment_id.in_(enrollment_ids),
        MissionAttempt.release_id == challenge.release_id,
        MissionAttempt.lesson_key == challenge.lesson_key,
        MissionAttempt.activity_key == challenge.activity_key,
    ).all() if enrollment_ids else []
    enrollment_students = {item.id: item.student_id for item in enrollments}
    successful = [item for item in attempts if item.outcome == "succeeded"]
    values = [
        value for value in (leaderboard_value(item, challenge.board_type) for item in successful)
        if value is not None
    ]
    higher_is_better = challenge.board_type in {"highest_score", "most_optional"}
    release = db.query(CourseRelease).filter(CourseRelease.id == challenge.release_id).one()
    _, activity = released_mission(release, challenge.lesson_key, challenge.activity_key)
    return {
        "challenge_id": challenge.id,
        "activity_title": activity["title"],
        "board_type": challenge.board_type,
        "release_version": release.version,
        "season": challenge.season,
        "member_count": len(memberships),
        "opted_in_count": sum(item.leaderboard_opt_in for item in memberships),
        "participant_count": len({enrollment_students[item.enrollment_id] for item in attempts}),
        "successful_participant_count": len({enrollment_students[item.enrollment_id] for item in successful}),
        "attempt_count": len(attempts),
        "successful_attempt_count": len(successful),
        "success_rate": round(len(successful) * 100 / len(attempts), 1) if attempts else 0,
        "average_value": round(sum(values) / len(values), 3) if values else None,
        "best_value": round((max(values) if higher_is_better else min(values)), 3) if values else None,
        "outcomes": dict(Counter(item.outcome for item in attempts)),
    }


@router.get("/class-challenges/{challenge_id}/leaderboard")
def read_leaderboard(
    challenge_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    challenge = challenge_or_404(db, challenge_id)
    assignment = assignment_or_404(db, challenge.assignment_id)
    group = db.query(ClassGroup).filter(ClassGroup.id == assignment.group_id).one()
    teacher_view = user.id == group.teacher_id and user.role in (UserRole.TUTOR, UserRole.ADMIN)
    if not teacher_view:
        require_student(user)
        membership = active_membership_or_404(db, user, group.id)
        if not membership.leaderboard_opt_in:
            raise HTTPException(status_code=403, detail="Opt in before viewing this class challenge")
    if not group.leaderboards_enabled or not challenge.enabled or group.status != "active":
        raise HTTPException(status_code=404, detail="Class challenge is not enabled")

    memberships = db.query(ClassMembership).filter(
        ClassMembership.group_id == group.id,
        ClassMembership.removed_at.is_(None),
        ClassMembership.leaderboard_opt_in.is_(True),
    ).all()
    aliases = {item.student_id: item.display_alias for item in memberships}
    enrollments = db.query(Enrollment).filter(
        Enrollment.student_id.in_(list(aliases)),
        Enrollment.course_id == assignment.course_id,
    ).all() if aliases else []
    students_by_enrollment = {item.id: item.student_id for item in enrollments}
    attempts = db.query(MissionAttempt).filter(
        MissionAttempt.enrollment_id.in_(list(students_by_enrollment)),
        MissionAttempt.release_id == challenge.release_id,
        MissionAttempt.lesson_key == challenge.lesson_key,
        MissionAttempt.activity_key == challenge.activity_key,
        MissionAttempt.outcome == "succeeded",
    ).all() if students_by_enrollment else []

    higher_is_better = challenge.board_type in {"highest_score", "most_optional"}
    best: dict[int, float] = {}
    for attempt in attempts:
        value = leaderboard_value(attempt, challenge.board_type)
        if value is None:
            continue
        student_id = students_by_enrollment[attempt.enrollment_id]
        if student_id not in best or (value > best[student_id] if higher_is_better else value < best[student_id]):
            best[student_id] = value
    ordered = sorted(best.items(), key=lambda item: item[1], reverse=higher_is_better)
    entries = []
    previous_value: Optional[float] = None
    previous_rank = 0
    for index, (student_id, value) in enumerate(ordered, start=1):
        tied = previous_value is not None and abs(value - previous_value) <= challenge.tie_tolerance
        rank = previous_rank if tied else index
        entries.append({"rank": rank, "alias": aliases[student_id], "value": round(value, 3)})
        previous_value, previous_rank = value, rank

    release = db.query(CourseRelease).filter(CourseRelease.id == challenge.release_id).one()
    _, activity = released_mission(release, challenge.lesson_key, challenge.activity_key)
    return {
        "challenge_id": challenge.id,
        "group_name": group.name,
        "activity_title": activity["title"],
        "board_type": challenge.board_type,
        "tie_tolerance": challenge.tie_tolerance,
        "release_id": release.id,
        "release_version": release.version,
        "season": challenge.season,
        "friendly_competition": True,
        "entries": entries,
    }


def release_activity_types(release: CourseRelease) -> dict[tuple[str, str], str]:
    return {
        (lesson["lessonKey"], activity["key"]): activity["type"]
        for lesson in release_lessons(release)
        for activity in lesson.get("activities", [])
    }


def enrollment_analytics(db: Session, enrollment: Enrollment, latest_release_id: Optional[int]) -> dict[str, Any]:
    release = db.query(CourseRelease).filter(CourseRelease.id == enrollment.active_release_id).one()
    lessons = release_lessons(release)
    activities = {
        (lesson["lessonKey"], activity["key"]): activity
        for lesson in lessons
        for activity in lesson.get("activities", [])
    }
    progress = db.query(LessonProgress).filter(
        LessonProgress.enrollment_id == enrollment.id,
        LessonProgress.release_id == release.id,
    ).all()
    completed = sum(item.state == "completed" for item in progress)
    attempts = db.query(MissionAttempt).filter(
        MissionAttempt.enrollment_id == enrollment.id,
        MissionAttempt.release_id == release.id,
    ).order_by(MissionAttempt.attempt_number).all()
    successful = [item for item in attempts if item.outcome == "succeeded"]
    scored = [item for item in successful if item.score_result]
    answers = db.query(ActivityAnswer).filter(
        ActivityAnswer.enrollment_id == enrollment.id,
        ActivityAnswer.release_id == release.id,
    ).all()
    activity_types = release_activity_types(release)
    question_answers = [
        item for item in answers
        if activity_types.get((item.lesson_key, item.activity_key)) in {
            "multiple_choice", "multiple_select", "numeric_answer"
        } and item.correctness is not None
    ]
    review_lessons = {
        lesson["lessonKey"] for lesson in lessons if lesson.get("completionPolicy") == "teacher_review"
    }
    awaiting_review = any(
        item.lesson_key in review_lessons and item.satisfied for item in answers
    ) and not all(
        next((item.state for item in progress if item.lesson_key == key), "not_started") == "completed"
        for key in review_lessons
    )
    activity_times = [
        value for value in (
            [item.updated_at for item in progress]
            + [item.updated_at for item in db.query(LessonWorkspace).filter(
                LessonWorkspace.enrollment_id == enrollment.id,
                LessonWorkspace.release_id == release.id,
            ).all()]
            + [item.last_submitted_at for item in answers]
            + [item.created_at for item in attempts]
        ) if value is not None
    ]
    student = db.query(User).filter(User.id == enrollment.student_id).one()
    latest_attempt = successful[-1] if successful else (attempts[-1] if attempts else None)
    best_attempt = max(scored, key=lambda item: item.score_result["total"]) if scored else None
    outcome_reasons = Counter()
    for attempt in attempts:
        if attempt.outcome == "succeeded":
            continue
        signals = set()
        if attempt.metrics.get("collisions", 0) > 0:
            signals.add("collision")
        if attempt.completion_reason == "timeout":
            signals.add("timeout")
        if attempt.outcome == "runtime_error" or attempt.completion_reason == "runtime_error":
            signals.add("runtime_error")
        activity = activities.get((attempt.lesson_key, attempt.activity_key), {})
        checkpoint_keys = {
            objective["key"] for objective in activity.get("objectives", [])
            if objective.get("condition", {}).get("type") == "checkpoints"
        }
        if any(
            result.get("key") in checkpoint_keys and result.get("status") != "succeeded"
            for result in attempt.objective_results
        ):
            signals.add("missed_checkpoint")
        if not signals:
            signals.add(attempt.completion_reason)
        outcome_reasons.update(signals)
    return {
        "enrollment_id": enrollment.id,
        "student": {
            "username": student.username,
            "display_name": f"{student.firstname} {student.lastname}".strip() or student.username,
        },
        "active_release": {"id": release.id, "version": release.version},
        "update_available": latest_release_id is not None and latest_release_id != release.id,
        "enrolled_at": enrollment.enrolled_at,
        "last_activity_at": max(activity_times) if activity_times else enrollment.enrolled_at,
        "completion": {
            "completed_lessons": completed,
            "total_lessons": len(lessons),
            "percent": round(completed * 100 / len(lessons)) if lessons else 0,
            "course_completed_at": enrollment.completed_at,
        },
        "attempt_count": len(attempts),
        "latest_mission_result": {
            "outcome": latest_attempt.outcome,
            "reason": latest_attempt.completion_reason,
            "score": latest_attempt.score_result,
        } if latest_attempt else None,
        "best_mission_result": {
            "score": best_attempt.score_result,
            "lesson_key": best_attempt.lesson_key,
            "activity_key": best_attempt.activity_key,
        } if best_attempt else None,
        "question_accuracy": {
            "correct": sum(item.correctness is True for item in question_answers),
            "answered": len(question_answers),
        },
        "awaiting_review": awaiting_review,
        "outcome_reasons": dict(outcome_reasons),
    }


@router.get("/teach/courses/{course_id}/progress")
def read_course_progress(
    course_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_teacher(user)
    course = db.query(Course).filter(Course.id == course_id, Course.author_id == user.id).first()
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    enrollments = db.query(Enrollment).filter(
        Enrollment.course_id == course.id,
    ).order_by(Enrollment.enrolled_at).all()
    students = [
        enrollment_analytics(db, enrollment, course.latest_published_release_id)
        for enrollment in enrollments
    ]
    common_reasons = Counter()
    for student in students:
        common_reasons.update(student["outcome_reasons"])
    return {
        "course": {"id": course.id, "title": course.title},
        "enrollment_count": len(students),
        "completed_count": sum(student["completion"]["course_completed_at"] is not None for student in students),
        "awaiting_review_count": sum(student["awaiting_review"] for student in students),
        "common_outcome_reasons": dict(common_reasons),
        "students": students,
        "retention": {
            "includes": ["completion", "compact mission metrics", "question correctness", "last activity"],
            "excludes": ["raw sensor traces", "edit history", "unbounded telemetry"],
        },
    }
