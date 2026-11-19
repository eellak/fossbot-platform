import asyncio
import base64
import datetime
import hmac

import jwt
import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException

import main
from routers import courses, stage_sources
from utils import utils_jwt
from utils.github_app_auth import create_github_app_jwt


SECRET = 'test-only-jwt-secret-with-at-least-32-bytes'
# Generated with python-jose 3.3.0 to preserve existing platform sessions.
LEGACY_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJsZWdhY3ktdXNlciJ9.YNOA-IfQwOIjjZnLL1EsJpdv3rAM1zhetOL5jgyG374'


def test_platform_tokens_remain_compatible(monkeypatch):
    monkeypatch.setattr(utils_jwt, 'SECRET_KEY', SECRET)
    assert utils_jwt.verify_access_token(LEGACY_TOKEN) == {'sub': 'legacy-user'}
    token = utils_jwt.create_access_token({'sub': 'new-user'})
    assert jwt.decode(token, SECRET, algorithms=['HS256']) == {'sub': 'new-user'}


@pytest.mark.parametrize('claims,algorithm,key', [
    ({'sub': 'user', 'exp': 1}, 'HS256', SECRET),
    ({'sub': 'user'}, 'HS384', SECRET),
    ({'sub': 'user'}, 'HS256', 'wrong-test-secret-with-at-least-32-bytes'),
    ({'sub': 'user'}, 'none', ''),
])
def test_platform_rejects_invalid_tokens(monkeypatch, claims, algorithm, key):
    monkeypatch.setattr(utils_jwt, 'SECRET_KEY', SECRET)
    token = jwt.encode(claims, key, algorithm=algorithm)
    with pytest.raises(jwt.PyJWTError):
        utils_jwt.verify_access_token(token)


def test_invalid_tokens_preserve_route_error_handling(db):
    for authenticate in (main.get_current_user, main.read_users_me, stage_sources.get_current_user):
        with pytest.raises(HTTPException) as error:
            asyncio.run(authenticate('invalid-token', db))
        assert error.value.status_code == 401
    assert courses.optional_current_user('invalid-token', db) is None


@pytest.fixture(scope='module')
def signing_material():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(x509.NameOID.COMMON_NAME, 'Firebase test')])
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (x509.CertificateBuilder()
            .subject_name(name).issuer_name(name).public_key(key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(now - datetime.timedelta(days=1))
            .not_valid_after(now + datetime.timedelta(days=1))
            .sign(key, hashes.SHA256()))
    return key, cert.public_bytes(serialization.Encoding.PEM).decode('ascii')


@pytest.fixture
def firebase_claims(monkeypatch, signing_material):
    _, cert = signing_material
    monkeypatch.setenv('FIREBASE_PROJECT_ID', 'test-project')
    monkeypatch.setattr(main, 'get_firebase_public_certs', lambda: {'test-key': cert})
    now = int(datetime.datetime.now(datetime.timezone.utc).timestamp())
    return {'sub': 'firebase-user', 'aud': 'test-project',
            'iss': 'https://securetoken.google.com/test-project', 'iat': now, 'exp': now + 300}


def test_firebase_verifies_x509_certificate(firebase_claims, signing_material):
    key, _ = signing_material
    token = jwt.encode(firebase_claims, key, algorithm='RS256', headers={'kid': 'test-key'})
    assert main.verify_firebase_id_token(token)['uid'] == 'firebase-user'


@pytest.mark.parametrize('change', [
    {'aud': 'other-project'}, {'iss': 'https://attacker.test'}, {'exp': 1},
])
def test_firebase_rejects_invalid_claims(firebase_claims, signing_material, change):
    key, _ = signing_material
    token = jwt.encode({**firebase_claims, **change}, key, algorithm='RS256', headers={'kid': 'test-key'})
    with pytest.raises(jwt.PyJWTError):
        main.verify_firebase_id_token(token)


def test_firebase_rejects_invalid_keys_and_algorithm_confusion(firebase_claims, signing_material):
    key, _ = signing_material
    unknown_key_token = jwt.encode(firebase_claims, key, algorithm='RS256', headers={'kid': 'unknown'})
    wrong_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    wrong_signature_token = jwt.encode(firebase_claims, wrong_key, algorithm='RS256', headers={'kid': 'test-key'})
    public_der = key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    # Build the attack signature directly: patched PyJWT refuses public keys as HMAC secrets.
    signing_input = jwt.encode(firebase_claims, SECRET, algorithm='HS256', headers={'kid': 'test-key'}).rsplit('.', 1)[0]
    signature = base64.urlsafe_b64encode(hmac.digest(public_der, signing_input.encode('ascii'), 'sha256')).rstrip(b'=').decode('ascii')
    forged_token = f'{signing_input}.{signature}'
    for token in (unknown_key_token, wrong_signature_token, forged_token):
        with pytest.raises(jwt.PyJWTError):
            main.verify_firebase_id_token(token)


def test_github_app_signing_still_uses_rs256(monkeypatch, signing_material):
    key, _ = signing_material
    monkeypatch.setenv('GITHUB_APP_ID', '123')
    monkeypatch.setenv('GITHUB_APP_PRIVATE_KEY', key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption()).decode('ascii'))
    claims = jwt.decode(create_github_app_jwt(), key.public_key(), algorithms=['RS256'])
    assert claims['iss'] == '123'
