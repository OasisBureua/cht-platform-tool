"""
Structured JSON logging for workers. Includes tracebacks for exc_info.
"""
import logging
import sys
from pythonjsonlogger import jsonlogger


class CustomJsonFormatter(jsonlogger.JsonFormatter):
    """JSON formatter that includes exception traceback when exc_info is set."""

    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)
        log_record["logger"] = record.name
        log_record["level"] = record.levelname
        if record.exc_info:
            log_record["traceback"] = self.formatException(record.exc_info)


def setup_logger(name: str, level: str = "INFO") -> logging.Logger:
    """
    Setup JSON logger for structured logging.
    Use logger.error("msg", exc_info=True) to include tracebacks.
    """
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    if logger.handlers:
        return logger

    handler = logging.StreamHandler(sys.stdout)
    formatter = CustomJsonFormatter(
        "%(asctime)s %(name)s %(levelname)s %(message)s"
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    return logger