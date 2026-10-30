import datetime

from fastapi import FastAPI
from fastapi.testclient import TestClient

from database.database import AIPolicyRule, AIProviderConfig, AIInstanceSettings, ClassGroup, ClassMembership
from routers import ai, ai_admin, ai_teaching
from utils.ai.capabilities import CAPABILITIES
from utils.guest_access import Participant


def client_for(db, user):
    app = FastAPI()
    app.include_router(ai.router)
    app.include_router(ai_admin.router)
    app.include_router(ai_teaching.router)

    def override_db():
        yield db

    for module in (ai, ai_admin, ai_teaching):
        app.dependency_overrides[module.get_db] = override_db
        if module is not ai:
            app.dependency_overrides[module.get_current_user] = lambda: user
    app.dependency_overrides[ai.get_participant] = lambda: Participant(user=user)
    return TestClient(app)


def provider(db, admin, name, *, runtime="hosted", enabled=True, class_assignable=False, provider_type="openai"):
    row = AIProviderConfig(
        name=name,
        provider_type=provider_type,
        runtime=runtime,
        enabled=enabled,
        class_assignable=class_assignable,
        model="test-model",
        settings={"version": "1"},
        created_by_id=admin.id,
        updated_by_id=admin.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def settings(db, admin, **overrides):
    row = AIInstanceSettings(id=1, enabled=True, registry_version="1", updated_by_id=admin.id, **overrides)
    db.add(row)
    db.commit()
    return row


def group_with_student(db, tutor, student, *, status="active"):
    group = ClassGroup(teacher_id=tutor.id, name="Robotics", status=status, join_code=f"AI-{status}-{student.id}", leaderboards_enabled=False)
    db.add(group)
    db.commit()
    db.refresh(group)
    db.add(ClassMembership(group_id=group.id, student_id=student.id, display_alias="Learner", removed_at=None))
    db.commit()
    return group


def instance_allow(db, admin, provider_id=None):
    db.add(AIPolicyRule(
        scope_type="instance",
        scope_key="*",
        capability="code.explain",
        effect="allow",
        provider_ids=[provider_id] if provider_id else None,
        created_by_id=admin.id,
        updated_by_id=admin.id,
    ))
    db.commit()


def decision_for(db, student, capability="code.explain"):
    with client_for(db, student) as client:
        payload = client.get("/api/ai/access").json()
    return next(item for item in payload["capabilities"] if item["capability"] == capability)


def test_teacher_assignment_grants_one_provider_for_every_capability(db, users):
    tutor, _, student, admin = users
    settings(db, admin)
    assigned = provider(db, admin, "Classroom hosted", class_assignable=True)
    provider(db, admin, "Admin only hosted", class_assignable=False)
    group = group_with_student(db, tutor, student)

    with client_for(db, tutor) as client:
        response = client.put(f"/api/class-groups/{group.id}/ai", json={"providerId": assigned.id})
        assert response.status_code == 200
        payload = response.json()
        assert payload["assignment"] == {"providerId": assigned.id, "providerName": assigned.name, "status": "active"}
        assert [item["id"] for item in payload["providers"]] == [assigned.id]

    rules = db.query(AIPolicyRule).filter(AIPolicyRule.scope_type == "class_group").all()
    assert {rule.capability for rule in rules} == {capability.id for capability in CAPABILITIES}
    assert {rule.authority for rule in rules} == {"class_teacher"}
    assert all(rule.provider_ids == [assigned.id] and rule.effect == "allow" for rule in rules)

    decision = decision_for(db, student)
    assert decision["winningScope"] == "class_group"
    assert decision["providerIds"] == [assigned.id]
    assert decision["defaultProviderId"] == assigned.id


def test_assignment_authorization(db, users):
    tutor, other_tutor, student, admin = users
    settings(db, admin)
    assigned = provider(db, admin, "Classroom hosted", class_assignable=True)
    group = group_with_student(db, tutor, student)
    body = {"providerId": assigned.id}

    with client_for(db, other_tutor) as client:
        assert client.put(f"/api/class-groups/{group.id}/ai", json=body).status_code == 404
    with client_for(db, student) as client:
        assert client.put(f"/api/class-groups/{group.id}/ai", json=body).status_code == 403
        assert client.get(f"/api/class-groups/{group.id}/ai").status_code == 403
    with client_for(db, admin) as client:
        assert client.put(f"/api/class-groups/{group.id}/ai", json=body).status_code == 200

    archived = group_with_student(db, tutor, student, status="archived")
    with client_for(db, tutor) as client:
        assert client.put(f"/api/class-groups/{archived.id}/ai", json=body).status_code == 409
        assert client.get(f"/api/class-groups/{archived.id}/ai").status_code == 200


def test_assignment_rejects_unusable_providers(db, users):
    tutor, _, student, admin = users
    settings(db, admin)
    group = group_with_student(db, tutor, student)
    disabled = provider(db, admin, "Disabled", enabled=False, class_assignable=True)
    not_assignable = provider(db, admin, "Not assignable")
    personal = provider(db, admin, "Personal", runtime="user_local", provider_type="openai_compatible", class_assignable=True)

    with client_for(db, tutor) as client:
        for candidate in (disabled, not_assignable, personal):
            assert client.put(f"/api/class-groups/{group.id}/ai", json={"providerId": candidate.id}).status_code == 422
        assert client.put(f"/api/class-groups/{group.id}/ai", json={"providerId": 999999}).status_code == 422
    assert db.query(AIPolicyRule).filter(AIPolicyRule.scope_type == "class_group").count() == 0


def test_admin_rule_blocks_teacher_write_and_keeps_its_providers(db, users):
    tutor, _, student, admin = users
    settings(db, admin)
    admin_provider = provider(db, admin, "Admin hosted")
    assigned = provider(db, admin, "Classroom hosted", class_assignable=True)
    group = group_with_student(db, tutor, student)

    with client_for(db, admin) as client:
        assert client.put("/api/admin/ai/policies", json={
            "scopeType": "class_group",
            "scopeKey": str(group.id),
            "capability": "code.explain",
            "effect": "allow",
            "providerIds": [admin_provider.id],
        }).status_code == 200

    with client_for(db, tutor) as client:
        assert client.put(f"/api/class-groups/{group.id}/ai", json={"providerId": assigned.id}).status_code == 409

    with client_for(db, admin) as client:
        response = client.put("/api/admin/ai/policies", json={
            "scopeType": "class_group",
            "scopeKey": str(group.id),
            "capability": "code.explain",
            "effect": "allow",
        })
        assert response.status_code == 200
        assert response.json()["providerIds"] == [admin_provider.id]
        assert response.json()["authority"] == "admin"


def test_teacher_can_clear_and_block_their_own_class(db, users):
    tutor, _, student, admin = users
    settings(db, admin)
    instance_provider = provider(db, admin, "Instance hosted")
    instance_allow(db, admin, instance_provider.id)
    assigned = provider(db, admin, "Classroom hosted", class_assignable=True)
    group = group_with_student(db, tutor, student)

    with client_for(db, tutor) as client:
        assert client.put(f"/api/class-groups/{group.id}/ai", json={"providerId": assigned.id}).status_code == 200
        assert decision_for(db, student)["providerIds"] == [assigned.id]

        assert client.delete(f"/api/class-groups/{group.id}/ai").status_code == 204
        assert client.get(f"/api/class-groups/{group.id}/ai").json()["assignment"] is None
    assert db.query(AIPolicyRule).filter(AIPolicyRule.authority == "class_teacher").count() == 0
    assert decision_for(db, student)["winningScope"] == "instance"

    with client_for(db, tutor) as client:
        assert client.put(f"/api/class-groups/{group.id}/ai/block", json={"blocked": True}).status_code == 200
        assert client.get(f"/api/class-groups/{group.id}/ai").json()["blocked"] is True
        assert client.put(f"/api/class-groups/{group.id}/ai", json={"providerId": assigned.id}).status_code == 200

    blocked = decision_for(db, student)
    assert blocked["winningScope"] == "instance"
    assert blocked["providerIds"] == [instance_provider.id]


def test_stale_teacher_rule_falls_back_after_provider_is_disabled(db, users):
    tutor, _, student, admin = users
    settings(db, admin)
    instance_provider = provider(db, admin, "Instance hosted")
    instance_allow(db, admin, instance_provider.id)
    assigned = provider(db, admin, "Classroom hosted", class_assignable=True)
    group = group_with_student(db, tutor, student)

    with client_for(db, tutor) as client:
        assert client.put(f"/api/class-groups/{group.id}/ai", json={"providerId": assigned.id}).status_code == 200
    assert decision_for(db, student)["providerIds"] == [assigned.id]

    assigned.enabled = False
    db.commit()
    decision = decision_for(db, student)
    assert decision["winningScope"] == "instance"
    assert decision["providerIds"] == [instance_provider.id]
    with client_for(db, tutor) as client:
        assert client.get(f"/api/class-groups/{group.id}/ai").json()["assignment"]["status"] == "disabled"


def test_students_blocked_stops_students_but_not_tutors(db, users):
    tutor, _, student, admin = users
    settings(db, admin, students_blocked=True)
    instance_allow(db, admin, provider(db, admin, "Instance hosted").id)

    student_decision = decision_for(db, student)
    assert student_decision["allowed"] is False
    assert student_decision["reasonCode"] == "students_blocked"
    assert student_decision["providerIds"] == []

    assert decision_for(db, tutor)["reasonCode"] == "instance_allowed"
