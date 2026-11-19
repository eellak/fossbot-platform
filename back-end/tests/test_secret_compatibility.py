import pytest

from utils.ai.secrets import decrypt_ai_secret
from utils.github_app_auth import decrypt_secret


# Generated with cryptography 42.0.8 to protect credentials stored before the upgrade.
LEGACY_KEY = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8='
LEGACY_CIPHERTEXT = 'gAAAAABq_Eo0_Fm2E7bAttacTx7uM97gk6IaGxjSOgFhottemGhuYNgUWi8gjABMVRfuEuAp9_aEI0Zb7oAWMFmp6vUcfoCc7soKRxyq5ezUnlWLn68ROb4='


@pytest.mark.parametrize('key_variable,decrypt', [
    ('AI_SECRET_ENCRYPTION_KEY', decrypt_ai_secret),
    ('GITHUB_TOKEN_ENCRYPTION_KEY', decrypt_secret),
])
def test_existing_credentials_remain_decryptable(monkeypatch, key_variable, decrypt):
    monkeypatch.setenv(key_variable, LEGACY_KEY)
    assert decrypt(LEGACY_CIPHERTEXT) == 'stored-test-credential'
