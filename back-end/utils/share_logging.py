"""Keep project capabilities out of Uvicorn access request lines."""
import logging
from urllib.parse import unquote, urlsplit


class RedactSharedPaths(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.args, tuple) and len(record.args) == 5:
            args = list(record.args)
            uri = str(args[2])
            try:
                path = urlsplit(uri).path
                decoded = unquote(path)
                if "shared-projects" in decoded.lower() or "%" in path:
                    path = "/shared-projects/[redacted]"
            except ValueError:
                path = "/[redacted]"
            args[2] = path
            record.args = tuple(args)
        return True
