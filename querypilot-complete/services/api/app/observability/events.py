import logging
import time
logger = logging.getLogger("querypilot.audit")


class StageTimer:
    def __init__(self, stage: str):
        self.stage = stage
        self.started = 0.0

    def __enter__(self):
        self.started = time.perf_counter()
        return self

    def __exit__(self, exc_type, exc, tb):
        logger.info("stage=%s status=%s duration_ms=%d",
                    self.stage, "failed" if exc else "completed",
                    int((time.perf_counter() - self.started) * 1000))
