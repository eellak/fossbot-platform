import json

import pytest
from pydantic import ValidationError

from models.models import GuestSettingsUpdate, GuestView


def test_defaults_enable_every_safe_view_and_leave_beta_off():
    settings = GuestSettingsUpdate()
    assert settings.beta_tester is False
    assert settings.allowed_views == list(GuestView)
    assert {view.value for view in settings.allowed_views} == {
        "dashboard", "python", "blockly", "interactive", "rc",
        "courses", "classrooms", "stages", "stage_builder",
    }


def test_default_lists_are_not_shared_between_payloads():
    first = GuestSettingsUpdate()
    first.allowed_views.clear()
    assert GuestSettingsUpdate().allowed_views == list(GuestView)


def test_custom_selection_and_empty_selection_roundtrip_through_json():
    custom = GuestSettingsUpdate(beta_tester=True, allowed_views=["python", "classrooms"])
    assert custom.allowed_views == [GuestView.PYTHON, GuestView.CLASSROOMS]
    assert GuestSettingsUpdate.model_validate_json(custom.model_dump_json()) == custom

    disabled = GuestSettingsUpdate(allowed_views=[])
    assert disabled.allowed_views == []
    assert GuestSettingsUpdate.model_validate(json.loads(disabled.model_dump_json())).allowed_views == []


@pytest.mark.parametrize(
    "payload",
    [
        {"allowed_views": ["python", "python"]},
        {"allowed_views": ["admin"]},
        {"allowed_views": ["root"]},
        {"beta_tester": "yes"},
        {"beta_tester": 1},
        {"allowed_views": "python"},
        {"role": "admin"},
        {"allowed_views": ["courses"], "is_admin": True},
    ],
)
def test_malformed_duplicate_unknown_and_escalation_payloads_are_rejected(payload):
    with pytest.raises(ValidationError):
        GuestSettingsUpdate.model_validate(payload)
