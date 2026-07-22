import base64
import copy
import hashlib
import re
import urllib.parse
from dataclasses import dataclass
from typing import Any, Optional


DATA_URL_RE = re.compile(r"^data:([^;,]+)?((?:;[^,]*)?),(.*)$", re.DOTALL)
MAX_ASSET_BYTES = 10 * 1024 * 1024
MAX_TOTAL_ASSET_BYTES = 50 * 1024 * 1024


class StageAssetError(ValueError):
    pass


@dataclass(frozen=True)
class PackagedAsset:
    path: str
    content: bytes
    mime_type: str


@dataclass(frozen=True)
class PackagedStage:
    record: dict[str, Any]
    assets: list[PackagedAsset]


def _extension_for_mime(mime_type: str) -> str:
    normalized = (mime_type or "").lower()
    if "gltf-binary" in normalized or normalized.endswith("/glb"):
        return "glb"
    if "stl" in normalized:
        return "stl"
    if "obj" in normalized or normalized in {"text/plain", "application/octet-stream"}:
        return "obj"
    if "png" in normalized:
        return "png"
    if "jpeg" in normalized or "jpg" in normalized:
        return "jpg"
    if "mpeg" in normalized:
        return "mp3"
    if "wav" in normalized:
        return "wav"
    return "bin"


def _decode_data_url(value: str) -> tuple[bytes, str]:
    match = DATA_URL_RE.match(value)
    if not match:
        raise StageAssetError("Invalid data URL")

    mime_type = match.group(1) or "application/octet-stream"
    metadata = match.group(2) or ""
    data = match.group(3) or ""
    if ";base64" in metadata:
        content = base64.b64decode(data, validate=True)
    else:
        content = urllib.parse.unquote_to_bytes(data)

    if len(content) > MAX_ASSET_BYTES:
        raise StageAssetError("Uploaded asset is too large for GitHub stage storage")
    return content, mime_type


def _is_asset_key(key: str) -> bool:
    return key in {"filename", "source", "texture"}


def _replace_data_urls(value: Any, assets_by_hash: dict[str, PackagedAsset], total: list[int], key: Optional[str] = None) -> Any:
    if isinstance(value, dict):
        return {child_key: _replace_data_urls(child, assets_by_hash, total, child_key) for child_key, child in value.items()}

    if isinstance(value, list):
        return [_replace_data_urls(child, assets_by_hash, total, key) for child in value]

    if isinstance(value, str):
        if value.startswith("blob:") and _is_asset_key(key or ""):
            raise StageAssetError("Temporary blob: asset URLs cannot be saved to GitHub. Re-import the asset and try again.")
        if value.startswith("data:") and _is_asset_key(key or ""):
            content, mime_type = _decode_data_url(value)
            digest = hashlib.sha256(content).hexdigest()
            asset = assets_by_hash.get(digest)
            if not asset:
                total[0] += len(content)
                if total[0] > MAX_TOTAL_ASSET_BYTES:
                    raise StageAssetError("Stage assets are too large for one GitHub save")
                ext = _extension_for_mime(mime_type)
                asset = PackagedAsset(path=f"assets/{digest[:16]}.{ext}", content=content, mime_type=mime_type)
                assets_by_hash[digest] = asset
            return asset.path
    return value


def package_stage_assets(record: dict[str, Any]) -> PackagedStage:
    cloned = copy.deepcopy(record)
    assets_by_hash: dict[str, PackagedAsset] = {}
    total = [0]
    rewritten = _replace_data_urls(cloned, assets_by_hash, total)
    return PackagedStage(record=rewritten, assets=list(assets_by_hash.values()))
