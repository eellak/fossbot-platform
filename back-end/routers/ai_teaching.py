from __future__ import annotations

from database.database import AIProviderConfig, AIPolicyRule, ClassGroup, User
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import ConfigDict
from sqlalchemy.orm import Session

from routers.ai_admin import APIModel
from routers.classrooms import require_teacher
from routers.stage_sources import get_current_user, get_db
from utils.ai.capabilities import CAPABILITIES
from models.models import UserRole


router = APIRouter(prefix="/api/class-groups", tags=["ai-teaching"])


class ClassProviderAssignment(APIModel):
    provider_id: int


class ClassBuddyBlock(APIModel):
    blocked: bool


def _group_or_404(db: Session, user: User, group_id: int) -> ClassGroup:
    require_teacher(user)
    query = db.query(ClassGroup).filter(ClassGroup.id == group_id)
    if user.role != UserRole.ADMIN:
        query = query.filter(ClassGroup.teacher_id == user.id)
    group = query.first()
    if group is None:
        raise HTTPException(status_code=404, detail="Class group not found")
    return group


def class_buddy_payload(db: Session, group: ClassGroup) -> dict:
    providers = {provider.id: provider for provider in db.query(AIProviderConfig).order_by(AIProviderConfig.id).all()}
    rules = db.query(AIPolicyRule).filter(
        AIPolicyRule.scope_type == "class_group",
        AIPolicyRule.scope_key == str(group.id),
    ).all()
    assigned_ids = sorted({
        provider_id
        for rule in rules
        if rule.authority == "class_teacher"
        for provider_id in (rule.provider_ids or [])
    })
    assignment = None
    if len(assigned_ids) == 1:
        provider = providers.get(assigned_ids[0])
        if provider is None:
            assignment = {"providerId": assigned_ids[0], "providerName": None, "status": "removed"}
        else:
            status = "active" if provider.enabled and provider.class_assignable else ("disabled" if not provider.enabled else "not_assignable")
            assignment = {"providerId": provider.id, "providerName": provider.name, "status": status}
    return {
        "blocked": bool(group.ai_blocked),
        "adminSet": any(rule.authority == "admin" for rule in rules),
        "assignment": assignment,
        "providers": [
            {"id": provider.id, "name": provider.name, "runtime": provider.runtime, "model": provider.model}
            for provider in providers.values()
            if provider.enabled and provider.class_assignable and provider.runtime != "user_local"
        ],
    }


@router.get("/{group_id}/ai")
def read_class_buddy(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return class_buddy_payload(db, _group_or_404(db, current_user, group_id))


@router.put("/{group_id}/ai")
def assign_class_provider(
    group_id: int,
    request: ClassProviderAssignment,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    group = _group_or_404(db, current_user, group_id)
    if group.status != "active":
        raise HTTPException(status_code=409, detail="Archived classes cannot be assigned a provider")
    provider = db.query(AIProviderConfig).filter(AIProviderConfig.id == request.provider_id).first()
    if provider is None:
        raise HTTPException(status_code=422, detail="Unknown provider")
    if not provider.enabled:
        raise HTTPException(status_code=422, detail="Provider must be enabled")
    if not provider.class_assignable:
        raise HTTPException(status_code=422, detail="Provider is not assignable to classes")
    if provider.runtime == "user_local":
        raise HTTPException(status_code=422, detail="A personal endpoint provider cannot be assigned to a class")
    if db.query(AIPolicyRule.id).filter(
        AIPolicyRule.scope_type == "class_group",
        AIPolicyRule.scope_key == str(group.id),
        AIPolicyRule.authority == "admin",
    ).first():
        raise HTTPException(status_code=409, detail="An administrator has set Buddy access for this class")

    for capability in CAPABILITIES:
        rule = db.query(AIPolicyRule).filter(
            AIPolicyRule.scope_type == "class_group",
            AIPolicyRule.scope_key == str(group.id),
            AIPolicyRule.capability == capability.id,
        ).first()
        if rule is None:
            rule = AIPolicyRule(
                scope_type="class_group",
                scope_key=str(group.id),
                capability=capability.id,
                effect="allow",
                authority="class_teacher",
                created_by_id=current_user.id,
                updated_by_id=current_user.id,
            )
            db.add(rule)
        rule.effect = "allow"
        rule.authority = "class_teacher"
        rule.provider_ids = [provider.id]
        rule.runtimes = None
        rule.updated_by_id = current_user.id
    db.commit()
    return class_buddy_payload(db, group)


@router.delete("/{group_id}/ai", status_code=204)
def clear_class_provider(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    group = _group_or_404(db, current_user, group_id)
    for rule in db.query(AIPolicyRule).filter(
        AIPolicyRule.scope_type == "class_group",
        AIPolicyRule.scope_key == str(group.id),
        AIPolicyRule.authority == "class_teacher",
    ).all():
        db.delete(rule)
    db.commit()
    return Response(status_code=204)


@router.put("/{group_id}/ai/block")
def set_class_buddy_block(
    group_id: int,
    request: ClassBuddyBlock,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    group = _group_or_404(db, current_user, group_id)
    group.ai_blocked = request.blocked
    db.commit()
    return {"blocked": bool(group.ai_blocked)}
