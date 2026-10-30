from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Optional

from utils.ai.capabilities import CAPABILITY_IDS, POLICY_VERSION


@dataclass(frozen=True)
class ProviderInventoryItem:
    id: int
    name: str
    provider_type: str
    runtime: str
    model: str
    enabled: bool
    request_limit: Optional[int] = None
    token_limit: Optional[int] = None
    class_assignable: bool = False


@dataclass(frozen=True)
class PolicyRuleInput:
    id: int
    scope_type: str
    scope_key: str
    capability: str
    effect: str
    provider_ids: tuple[int, ...] = ()
    runtimes: tuple[str, ...] = ()
    authority: str = "admin"


@dataclass(frozen=True)
class PolicyDecision:
    allowed: bool
    reason_code: str
    detail: str
    winning_scope: Optional[str]
    winning_rule_id: Optional[int]
    provider_ids: tuple[int, ...]
    runtime_ids: tuple[str, ...]
    default_provider_id: Optional[int]
    request_limit: Optional[int]
    token_limit: Optional[int]
    policy_version: str = POLICY_VERSION


def _limit(values: Iterable[Optional[int]]) -> Optional[int]:
    present = [value for value in values if value is not None]
    return min(present) if present else None


def _usable_rule(rule: PolicyRuleInput, enabled: dict[int, ProviderInventoryItem]) -> bool:
    """A delegated class rule stops applying once its provider cannot serve a class."""
    if rule.authority != "class_teacher":
        return True
    if not rule.provider_ids:
        return False
    return all(provider_id in enabled and enabled[provider_id].class_assignable for provider_id in rule.provider_ids)


def _select_group_rule(rules: list[PolicyRuleInput]) -> Optional[PolicyRuleInput]:
    if not rules:
        return None
    denied = sorted((rule for rule in rules if rule.effect == "deny"), key=lambda rule: rule.id)
    if denied:
        return denied[0]
    allowed = sorted(rules, key=lambda rule: rule.id)
    provider_ids = () if any(not rule.provider_ids for rule in allowed) else tuple(sorted({provider_id for rule in allowed for provider_id in rule.provider_ids}))
    runtimes = () if any(not rule.runtimes for rule in allowed) else tuple(sorted({runtime for rule in allowed for runtime in rule.runtimes}))
    first = allowed[0]
    return PolicyRuleInput(
        id=first.id,
        scope_type=first.scope_type,
        scope_key=first.scope_key,
        capability=first.capability,
        effect=first.effect,
        provider_ids=provider_ids,
        runtimes=runtimes,
    )


def resolve_capability(
    *,
    instance_enabled: bool,
    user_id: int,
    role: str,
    active_group_ids: Iterable[int],
    capability: str,
    providers: Iterable[ProviderInventoryItem],
    rules: Iterable[PolicyRuleInput],
    default_provider_id: Optional[int] = None,
    instance_request_limit: Optional[int] = None,
    instance_token_limit: Optional[int] = None,
    students_blocked: bool = False,
    blocked_group_ids: Iterable[int] = (),
) -> PolicyDecision:
    if capability not in CAPABILITY_IDS:
        raise ValueError("Unknown AI capability")

    if not instance_enabled:
        return PolicyDecision(False, "instance_disabled", "AI is disabled for this instance.", "instance", None, (), (), None, None, None)

    if students_blocked and role == "user":
        return PolicyDecision(False, "students_blocked", "An administrator has blocked Buddy for students.", "instance", None, (), (), None, None, None)

    enabled = {provider.id: provider for provider in providers if provider.enabled}
    if not enabled:
        return PolicyDecision(False, "no_enabled_provider", "No compatible AI provider is enabled.", "provider", None, (), (), None, None, None)

    relevant = [rule for rule in rules if rule.capability == capability and _usable_rule(rule, enabled)]
    blocked = {str(group_id) for group_id in blocked_group_ids}
    groups = {str(group_id) for group_id in active_group_ids} - blocked
    levels: list[tuple[str, Optional[PolicyRuleInput]]] = [
        ("instance", next((rule for rule in relevant if rule.scope_type == "instance" and rule.scope_key == "*"), None)),
        ("role", next((rule for rule in relevant if rule.scope_type == "role" and rule.scope_key == role), None)),
        ("class_group", _select_group_rule([rule for rule in relevant if rule.scope_type == "class_group" and rule.scope_key in groups])),
        ("user", next((rule for rule in relevant if rule.scope_type == "user" and rule.scope_key == str(user_id)), None)),
    ]
    winning_scope: Optional[str] = None
    winning_rule: Optional[PolicyRuleInput] = None
    for scope, rule in levels:
        if rule is not None:
            winning_scope, winning_rule = scope, rule

    if winning_rule is None:
        return PolicyDecision(False, "default_denied", "No access rule allows this capability.", None, None, (), (), None, None, None)
    if winning_rule.effect == "deny":
        return PolicyDecision(False, f"{winning_scope}_denied", "Access is denied by policy.", winning_scope, winning_rule.id, (), (), None, None, None)

    restricted_ids = set(winning_rule.provider_ids) if winning_rule.provider_ids else set(enabled)
    restricted_runtimes = set(winning_rule.runtimes) if winning_rule.runtimes else {provider.runtime for provider in enabled.values()}
    allowed = {
        provider_id: provider
        for provider_id, provider in enabled.items()
        if provider_id in restricted_ids and provider.runtime in restricted_runtimes
    }
    if not allowed:
        return PolicyDecision(False, "provider_unavailable", "The providers allowed by policy are unavailable.", winning_scope, winning_rule.id, (), (), None, None, None)

    ordered_ids = tuple(sorted(allowed))
    preferred_default = (
        winning_rule.provider_ids[0]
        if winning_scope == "class_group" and winning_rule.authority == "class_teacher" and winning_rule.provider_ids
        else default_provider_id
    )
    selected_default = preferred_default if preferred_default in allowed else ordered_ids[0]
    return PolicyDecision(
        True,
        f"{winning_scope}_allowed",
        "Access is allowed by policy.",
        winning_scope,
        winning_rule.id,
        ordered_ids,
        tuple(sorted({provider.runtime for provider in allowed.values()})),
        selected_default,
        _limit([instance_request_limit, *(provider.request_limit for provider in allowed.values())]),
        _limit([instance_token_limit, *(provider.token_limit for provider in allowed.values())]),
    )
