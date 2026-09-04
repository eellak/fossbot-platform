from utils.ai.capabilities import CAPABILITY_IDS, CAPABILITY_REGISTRY_VERSION
from utils.ai.policy import PolicyRuleInput, ProviderInventoryItem, resolve_capability


PROVIDER = ProviderInventoryItem(1, "Hosted", "openai", "hosted", "test-model", True, 100, 10_000)


def rule(rule_id: int, scope_type: str, scope_key: str, effect: str, *, providers=(), runtimes=()):
    return PolicyRuleInput(rule_id, scope_type, scope_key, "code.explain", effect, tuple(providers), tuple(runtimes))


def resolve(*rules, groups=(), providers=(PROVIDER,), enabled=True, user_id=7, role="user"):
    return resolve_capability(
        instance_enabled=enabled,
        user_id=user_id,
        role=role,
        active_group_ids=groups,
        capability="code.explain",
        providers=providers,
        rules=rules,
        default_provider_id=1,
        instance_request_limit=50,
        instance_token_limit=5_000,
    )


def test_registry_is_versioned_and_fixed():
    assert CAPABILITY_REGISTRY_VERSION == "1"
    assert CAPABILITY_IDS == {
        "code.explain",
        "code.suggest_changes",
        "blockly.explain",
        "blockly.suggest_changes",
        "lesson.draft",
        "lesson.suggest_changes",
        "stage.create",
        "stage.suggest_changes",
    }


def test_instance_role_group_user_precedence():
    decision = resolve(
        rule(1, "instance", "*", "deny"),
        rule(2, "role", "user", "allow"),
        rule(3, "class_group", "4", "deny"),
        rule(4, "user", "7", "allow"),
        groups=(4,),
    )
    assert decision.allowed is True
    assert decision.reason_code == "user_allowed"
    assert decision.winning_rule_id == 4


def test_group_deny_wins_conflict_and_removed_membership_is_ignored():
    rules = (
        rule(1, "instance", "*", "allow"),
        rule(2, "class_group", "4", "allow"),
        rule(3, "class_group", "5", "deny"),
    )
    assert resolve(*rules, groups=(4, 5)).reason_code == "class_group_denied"
    assert resolve(*rules, groups=(4,)).reason_code == "class_group_allowed"
    assert resolve(*rules, groups=()).reason_code == "instance_allowed"


def test_multiple_allowing_groups_merge_restrictions_deterministically():
    browser = ProviderInventoryItem(2, "Browser", "webllm", "browser", "local-model", True)
    decision = resolve(
        rule(1, "instance", "*", "deny"),
        rule(3, "class_group", "4", "allow", providers=(1,), runtimes=("hosted",)),
        rule(2, "class_group", "5", "allow", providers=(2,), runtimes=("browser",)),
        groups=(4, 5),
        providers=(PROVIDER, browser),
    )
    assert decision.allowed is True
    assert decision.winning_rule_id == 2
    assert decision.provider_ids == (1, 2)
    assert decision.runtime_ids == ("browser", "hosted")


def test_instance_and_provider_disable_are_absolute():
    allow = rule(1, "user", "7", "allow")
    assert resolve(allow, enabled=False).reason_code == "instance_disabled"
    disabled = ProviderInventoryItem(1, "Hosted", "openai", "hosted", "test-model", False)
    assert resolve(allow, providers=(disabled,)).reason_code == "no_enabled_provider"


def test_provider_restrictions_and_limits_are_enforced():
    second = ProviderInventoryItem(2, "Browser", "webllm", "browser", "local-model", True, 25, 2_000)
    allowed = resolve(rule(1, "instance", "*", "allow", providers=(2,), runtimes=("browser",)), providers=(PROVIDER, second))
    assert allowed.provider_ids == (2,)
    assert allowed.runtime_ids == ("browser",)
    assert allowed.request_limit == 25
    assert allowed.token_limit == 2_000
    unavailable = resolve(rule(2, "instance", "*", "allow", providers=(99,)), providers=(PROVIDER,))
    assert unavailable.reason_code == "provider_unavailable"


def test_unknown_capability_is_rejected():
    try:
        resolve_capability(
            instance_enabled=True,
            user_id=1,
            role="user",
            active_group_ids=(),
            capability="invented.capability",
            providers=(PROVIDER,),
            rules=(),
        )
    except ValueError as error:
        assert str(error) == "Unknown AI capability"
    else:
        raise AssertionError("Unknown capability was accepted")
