import logging
import uuid

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.core.config import get_settings
from app.core.errors import QueryPilotError
from app.db.models import Base
from app.db.session import engine
from app.schemas import APIErrorOut, HealthOut

logging.basicConfig(level=logging.INFO)
settings = get_settings()
settings.data_dir.mkdir(parents=True, exist_ok=True)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.app_name,
    version="0.2.0",
    description=(
        "Analyze CSV datasets with validated, read-only SQL. All API errors use a "
        "consistent error envelope with a request ID for troubleshooting."
    ),
    openapi_tags=[
        {"name": "health", "description": "Service liveness and readiness checks."},
        {"name": "datasets", "description": "Upload, inspect, and profile CSV datasets."},
        {"name": "analyses", "description": "Run and retrieve explainable data analyses."},
    ],
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
    expose_headers=["X-Request-ID"],
)
app.include_router(router, prefix=settings.api_prefix)


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request.state.request_id = uuid.uuid4().hex
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    return response


def _error_response(
    request: Request,
    status_code: int,
    code: str,
    message: str,
    details: list[dict[str, str]] | None = None,
) -> JSONResponse:
    request_id = getattr(request.state, "request_id", uuid.uuid4().hex)
    payload = {
        "error": {
            "code": code,
            "message": message,
            "request_id": request_id,
            "details": details,
        }
    }
    return JSONResponse(
        status_code=status_code,
        content=APIErrorOut.model_validate(payload).model_dump(exclude_none=True),
        headers={"X-Request-ID": request_id},
    )


@app.exception_handler(QueryPilotError)
async def querypilot_error_handler(request: Request, exc: QueryPilotError):
    return _error_response(request, exc.status_code, exc.code, exc.message, exc.details)


@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", "unknown")
    logging.getLogger("querypilot").exception(
        "Unhandled request error (request_id=%s)",
        request_id,
    )
    return _error_response(
        request,
        500,
        "INTERNAL_SERVER_ERROR",
        "An unexpected error occurred. Please try again or share the request ID with support.",
    )


@app.exception_handler(HTTPException)
async def http_error_handler(request: Request, exc: HTTPException):
    message = exc.detail if isinstance(exc.detail, str) else "The request could not be completed."
    return _error_response(request, exc.status_code, f"HTTP_{exc.status_code}", message)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    details = [
        {
            "field": ".".join(str(part) for part in error["loc"]),
            "message": error["msg"],
            "type": error["type"],
        }
        for error in exc.errors()
    ]
    return _error_response(
        request,
        422,
        "VALIDATION_ERROR",
        "The request contains invalid or missing fields.",
        details,
    )


@app.get("/health/live", tags=["health"], response_model=HealthOut, summary="Check liveness")
def live():
    return {"status": "ok"}


@app.get(
    "/health/ready",
    tags=["health"],
    response_model=HealthOut,
    responses={503: {"model": APIErrorOut, "description": "A required service is not ready."}},
    summary="Check readiness",
)
def ready():
    try:
        with engine.connect() as connection:
            connection.exec_driver_sql("SELECT 1")
        return {"status": "ready"}
    except Exception as exc:
        logging.getLogger("querypilot").exception("Readiness check failed")
        raise QueryPilotError(
            "SERVICE_NOT_READY",
            "The metadata database is not ready.",
            status_code=503,
        ) from exc
