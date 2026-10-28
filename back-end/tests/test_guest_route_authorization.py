from main import app
from utils.guest_access import (
    get_classroom_participant,
    get_course_access,
    get_course_view_participant,
    get_marketplace_access,
    get_participant,
)
from routers.stage_sources import get_beta_user, get_current_user


GUEST_ENTRY = {
    get_participant,
    get_classroom_participant,
    get_course_access,
    get_course_view_participant,
    get_marketplace_access,
}
ACCOUNT_ONLY = {get_current_user, get_beta_user}
MUTATING = {"POST", "PUT", "PATCH", "DELETE"}

# Mutations a guest may actually perform: joining/leaving a class, leaderboard
# consent, answering lesson activities, and submitting mission attempts.
GUEST_ALLOWED_MUTATIONS = {
    ("POST", "/class-groups/join"),
    ("PUT", "/class-groups/{group_id}/membership"),
    ("DELETE", "/class-groups/{group_id}/membership"),
    ("POST", "/enrollments/{enrollment_id}/lessons/{lesson_key}/activities/{activity_key}/submit"),
    ("POST", "/enrollments/{enrollment_id}/lessons/{lesson_key}/missions/{activity_key}/attempts"),
}

# These routes accept a participant dependency but explicitly reject guests
# because they mutate server progress or workspace state.
GUEST_REJECTED_PARTICIPANT_MUTATIONS = {
    ("POST", "/courses/{course_id}/enroll"),
    ("POST", "/enrollments/{enrollment_id}/lessons/{lesson_key}/start"),
    ("PUT", "/enrollments/{enrollment_id}/lessons/{lesson_key}/workspace"),
    ("POST", "/enrollments/{enrollment_id}/lessons/{lesson_key}/workspace/reset"),
    ("POST", "/enrollments/{enrollment_id}/lessons/{lesson_key}/complete"),
    ("DELETE", "/enrollments/{enrollment_id}/lessons/{lesson_key}/complete"),
    ("POST", "/enrollments/{enrollment_id}/update-release"),
}


def dependency_calls(dependant):
    calls = set()
    for dependency in dependant.dependencies:
        calls.add(dependency.call)
        calls.update(dependency_calls(dependency))
    return calls


def route_signatures():
    signatures = {}
    for route in app.routes:
        path = getattr(route, "path", None)
        methods = getattr(route, "methods", None)
        dependant = getattr(route, "dependant", None)
        if not path or not methods or dependant is None:
            continue
        calls = dependency_calls(dependant)
        for method in methods:
            signatures[(method, path)] = calls
    return signatures


def test_every_guest_mutation_is_an_explicit_narrow_exception():
    signatures = route_signatures()
    reached = {
        key for key, calls in signatures.items()
        if key[0] in MUTATING and calls & GUEST_ENTRY and not calls & ACCOUNT_ONLY
    }
    assert reached == GUEST_ALLOWED_MUTATIONS | GUEST_REJECTED_PARTICIPANT_MUTATIONS
