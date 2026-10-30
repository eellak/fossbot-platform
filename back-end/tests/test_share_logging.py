import logging
import pytest
from utils.share_logging import RedactSharedPaths


@pytest.mark.parametrize("uri", [
    "/shared-projects/secret-token", "/shared-projects/secret-token?copy=1",
    "/%73hared-projects/secret-token", "/shared%252dprojects/secret-token",
    "/SHARED-PROJECTS/secret-token", "/api/shared-projects/secret-token",
])
def test_capability_is_removed_from_uvicorn_record(uri):
    record = logging.LogRecord("uvicorn.access", logging.INFO, "", 0, '%s - "%s %s HTTP/%s" %d',
                               ("127.0.0.1", "GET", uri, "1.1", 200), None)
    assert RedactSharedPaths().filter(record)
    assert "secret-token" not in record.getMessage()
    assert record.args[1] == "GET"
    assert record.args[-1] == 200


def test_ordinary_record_retains_path_without_query():
    record = logging.LogRecord("uvicorn.access", logging.INFO, "", 0, "%s %s %s %s %s",
                               ("client", "GET", "/projects/1?secret=2", "1.1", 200), None)
    RedactSharedPaths().filter(record)
    assert record.args[2] == "/projects/1"
