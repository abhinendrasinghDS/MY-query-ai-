import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api import routes
from app.core.config import Settings
from app.db.models import Base
from app.db.session import get_db
from app.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    metadata_engine = create_engine(
        f"sqlite:///{tmp_path / 'metadata.sqlite'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=metadata_engine)
    test_sessions = sessionmaker(bind=metadata_engine, autoflush=False, autocommit=False)

    def get_test_db():
        with test_sessions() as session:
            yield session

    previous_overrides = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = get_test_db
    monkeypatch.setattr(
        routes,
        "get_settings",
        lambda: Settings(data_dir=tmp_path / "storage", upload_max_mb=1),
    )
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides = previous_overrides
    metadata_engine.dispose()


def test_validation_errors_include_stable_envelope_and_request_id():
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/analyses",
            json={"dataset_id": "", "question": "no"},
        )

    assert response.status_code == 422
    payload = response.json()["error"]
    assert payload["code"] == "VALIDATION_ERROR"
    assert payload["message"]
    assert payload["request_id"] == response.headers["x-request-id"]
    assert {item["field"] for item in payload["details"]} == {
        "body.dataset_id",
        "body.question",
    }


def test_missing_dataset_uses_domain_error_code():
    with TestClient(app) as client:
        response = client.get("/api/v1/datasets/not-a-real-dataset/schema")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "DATASET_NOT_FOUND"
    assert response.json()["error"]["request_id"] == response.headers["x-request-id"]


def test_health_endpoint_is_documented_and_healthy():
    with TestClient(app) as client:
        response = client.get("/health/live")
        schema = client.get("/openapi.json")

    paths = schema.json()["paths"]
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert {
        "/health/live",
        "/health/ready",
        "/api/v1/datasets",
        "/api/v1/datasets/upload",
        "/api/v1/datasets/{dataset_id}/schema",
        "/api/v1/datasets/{dataset_id}/profile",
        "/api/v1/analyses",
        "/api/v1/analyses/{analysis_id}",
    }.issubset(paths)
    assert "201" in paths["/api/v1/datasets/upload"]["post"]["responses"]
    assert "422" in paths["/api/v1/analyses"]["post"]["responses"]


def test_dataset_upload_schema_profile_and_list_contracts(client):
    upload = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("schools.csv", "school,year\nNorth,2024\nSouth,2025\n", "text/csv")},
    )

    assert upload.status_code == 201
    dataset = upload.json()
    assert dataset["row_count"] == 2

    listed = client.get("/api/v1/datasets")
    schema = client.get(f"/api/v1/datasets/{dataset['id']}/schema")
    profile = client.get(f"/api/v1/datasets/{dataset['id']}/profile")
    assert listed.status_code == schema.status_code == profile.status_code == 200
    assert listed.json()[0]["id"] == dataset["id"]
    assert schema.json()["tables"][dataset["table_name"]]["row_count"] == 2
    assert profile.json()["row_count"] == 2


@pytest.mark.parametrize(
    ("filename", "content", "status_code", "error_code"),
    [
        ("notes.txt", "not a csv", 400, "UNSUPPORTED_FILE_TYPE"),
        ("large.csv", "x" * (1024 * 1024 + 1), 413, "UPLOAD_TOO_LARGE"),
    ],
    ids=["unsupported-extension", "file-too-large"],
)
def test_upload_errors_use_the_standard_envelope(
    client,
    filename,
    content,
    status_code,
    error_code,
):
    response = client.post(
        "/api/v1/datasets/upload",
        files={"file": (filename, content, "text/csv")},
    )

    assert response.status_code == status_code
    assert response.json()["error"]["code"] == error_code
    assert response.json()["error"]["request_id"] == response.headers["x-request-id"]
