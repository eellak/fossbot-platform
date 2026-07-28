from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from routers.features import router as features_router
from routers.marketplace import router as marketplace_router
from utils.feature_flags import marketplace_enabled, require_marketplace_enabled


def test_marketplace_is_disabled_by_default(monkeypatch):
    monkeypatch.delenv("FOSSBOT_MARKETPLACE_ENABLED", raising=False)

    assert marketplace_enabled() is False


def test_marketplace_accepts_common_true_values(monkeypatch):
    for value in ("1", "true", "TRUE", "yes", "on"):
        monkeypatch.setenv("FOSSBOT_MARKETPLACE_ENABLED", value)
        assert marketplace_enabled() is True


def test_disabled_marketplace_returns_feature_disabled(monkeypatch):
    monkeypatch.setenv("FOSSBOT_MARKETPLACE_ENABLED", "false")

    try:
        require_marketplace_enabled()
    except HTTPException as error:
        assert error.status_code == 404
        assert error.detail["error"] == "feature_disabled"
    else:
        raise AssertionError("Disabled marketplace did not reject the request")


def test_feature_flags_endpoint_reads_runtime_environment(monkeypatch):
    app = FastAPI()
    app.include_router(features_router)
    client = TestClient(app)

    monkeypatch.setenv("FOSSBOT_MARKETPLACE_ENABLED", "false")
    assert client.get("/api/features").json() == {"marketplace": False}

    monkeypatch.setenv("FOSSBOT_MARKETPLACE_ENABLED", "true")
    assert client.get("/api/features").json() == {"marketplace": True}


def test_disabled_marketplace_router_rejects_direct_requests(monkeypatch):
    monkeypatch.setenv("FOSSBOT_MARKETPLACE_ENABLED", "false")
    app = FastAPI()
    app.include_router(marketplace_router)
    client = TestClient(app)

    response = client.get("/api/marketplace/index")

    assert response.status_code == 404
    assert response.json()["detail"]["error"] == "feature_disabled"
