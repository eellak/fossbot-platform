from io import BytesIO
from unittest.mock import patch
import pytest
from fastapi import HTTPException
from PIL import Image
from utils.website_images import normalize_website_image


@pytest.mark.parametrize('kind',['PNG','JPEG','WEBP'])
def test_normalizes_real_images_and_removes_appended_data(kind):
    source=BytesIO();Image.new('RGB',(12,8),'blue').save(source,format=kind)
    clean,mime=normalize_website_image(source.getvalue()+b'<script>untrusted appended content</script>')
    assert mime in ('image/png','image/jpeg','image/webp')
    assert b'<script>' not in clean
    with Image.open(BytesIO(clean)) as image:
        image.load();assert image.size==(12,8)


@pytest.mark.parametrize('raw',[b'\x89PNG\r\n\x1a\nnot an image',b'\xff\xd8\xffbad',b'<svg onload="bad"/>',b''])
def test_rejects_fake_headers_or_unsupported_formats(raw):
    with pytest.raises(HTTPException) as error: normalize_website_image(raw)
    assert error.value.status_code==422


def test_rejects_dimensions_before_decoding_large_image():
    image=Image.new('RGB',(1,1))
    source=BytesIO();image.save(source,format='PNG')
    with patch('utils.website_images.MAX_IMAGE_PIXELS',0):
        with pytest.raises(HTTPException) as error: normalize_website_image(source.getvalue())
    assert error.value.status_code==422


def test_busy_image_processors_return_retryable_error():
    with patch('utils.website_images._IMAGE_SLOTS') as slots:
        slots.acquire.return_value=False
        with pytest.raises(HTTPException) as error:normalize_website_image(b'anything')
        assert error.value.status_code==429
        slots.release.assert_not_called()
