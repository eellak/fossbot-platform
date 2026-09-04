import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "front-end" / "src"


def flatten_keys(value, prefix=""):
    keys = set()
    for key, child in value.items():
        path = f"{prefix}.{key}" if prefix else key
        keys.add(path)
        if isinstance(child, dict):
            keys.update(flatten_keys(child, path))
    return keys


def test_ai_translation_keys_have_english_greek_parity():
    translations = {}
    for language in ("en", "gr"):
        payload = json.loads((FRONTEND / "utils" / "languages" / f"{language}.json").read_text(encoding="utf-8"))
        translations[language] = flatten_keys({"aiAdmin": payload["aiAdmin"], "aiAssistant": payload["aiAssistant"]})
    assert translations["en"] == translations["gr"]


def test_ai_surfaces_do_not_render_provider_html_or_log_content():
    sources = [
        *sorted((FRONTEND / "ai").rglob("*.ts")),
        *sorted((FRONTEND / "ai").rglob("*.tsx")),
        *sorted((FRONTEND / "components" / "ai").rglob("*.tsx")),
        *sorted((FRONTEND / "views" / "ai-admin-page").rglob("*.tsx")),
    ]
    joined = "\n".join(path.read_text(encoding="utf-8") for path in sources)
    assert "dangerouslySetInnerHTML" not in joined
    assert "console.log(" not in joined
    assert "console.debug(" not in joined


def test_user_local_secret_is_session_only_and_login_body_is_not_logged():
    device_settings = (FRONTEND / "ai" / "runtimes" / "deviceSettings.ts").read_text(encoding="utf-8")
    backend_main = (ROOT / "back-end" / "main.py").read_text(encoding="utf-8")
    assert "sessionStorage.setItem(secretKey" in device_settings
    assert "localStorage.setItem(secretKey" not in device_settings
    assert 'logger.info(f"Request body: {login_request}")' not in backend_main


def test_admin_debug_ui_is_role_gated_and_transient():
    panel = (FRONTEND / "components" / "ai" / "AssistantPanel.tsx").read_text(encoding="utf-8")
    debug_panel = (FRONTEND / "components" / "ai" / "AdminDebugTrace.tsx").read_text(encoding="utf-8")
    course_assistant = (FRONTEND / "components" / "ai" / "AuthoringAssistant.tsx").read_text(encoding="utf-8")
    stage_assistant = (FRONTEND / "components" / "ai" / "StageAuthoringAssistant.tsx").read_text(encoding="utf-8")
    assert "user?.role === 'admin'" in panel
    assert "isAdmin && <AdminDebugToggle" in panel
    assert "isAdmin && debugEnabled && <AdminDebugTrace" in panel
    assert "<AssistantPanel" in course_assistant
    assert "<AssistantPanel" in stage_assistant
    assert "localStorage" not in debug_panel
    assert "sessionStorage" not in debug_panel
