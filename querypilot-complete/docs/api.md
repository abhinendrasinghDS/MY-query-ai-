# QueryPilot API

The interactive OpenAPI reference is available at `/docs`; the machine-readable
schema is available at `/openapi.json`.

## Conventions

- Base path: `/api/v1`
- Request and response bodies use JSON unless an endpoint says otherwise.
- Dataset uploads use `multipart/form-data` with a `file` field.
- Uploads accept CSV files only. The maximum size defaults to 20 MB and is
  configurable with `UPLOAD_MAX_MB`.
- Every error response uses the same envelope and includes a request ID in both
  the response body and the `X-Request-ID` response header.
- Analysis and upload requests return `201 Created`; reads return `200 OK`.

## Health

### `GET /health/live`

Checks that the API process is responding.

```json
{ "status": "ok" }
```

### `GET /health/ready`

Checks that the API can reach its metadata database.

```json
{ "status": "ready" }
```

Returns `503 Service Unavailable` with the standard error envelope if the
metadata database cannot be reached.

## Datasets

### `GET /api/v1/datasets`

Lists uploaded datasets in newest-first order. An empty workspace returns `[]`.

```json
[
  {
    "id": "dataset-id",
    "name": "schools.csv",
    "kind": "csv",
    "table_name": "schools",
    "created_at": "2026-10-24T10:30:00+00:00"
  }
]
```

### `POST /api/v1/datasets/upload`

Uploads a CSV using a multipart field named `file`.

```json
{
  "id": "dataset-id",
  "name": "schools.csv",
  "kind": "csv",
  "table_name": "schools",
  "created_at": "2026-10-24T10:30:00+00:00",
  "row_count": 120
}
```

Returns `201 Created`. Errors include `400 UNSUPPORTED_FILE_TYPE`,
`400 INVALID_CSV`, `413 UPLOAD_TOO_LARGE`, and `422 VALIDATION_ERROR`.

### `GET /api/v1/datasets/{dataset_id}/schema`

Returns each table's row count and column metadata.

```json
{
  "dataset_id": "dataset-id",
  "tables": {
    "schools": {
      "row_count": 120,
      "columns": [
        { "name": "school_name", "type": "TEXT", "nullable": true }
      ]
    }
  }
}
```

Returns `404 DATASET_NOT_FOUND` when the dataset does not exist.

### `GET /api/v1/datasets/{dataset_id}/profile`

Returns total row and column counts, plus sampled quality metrics for each
column. Sample metrics include null counts, distinct values, and representative
values.

```json
{
  "dataset_id": "dataset-id",
  "row_count": 120,
  "column_count": 2,
  "columns": [
    {
      "table": "schools",
      "name": "school_name",
      "type": "TEXT",
      "null_count_sample": 0,
      "sample_size": 120,
      "distinct_sample": 12,
      "duplicate_value_candidates": [],
      "sample_values": ["North School"]
    }
  ]
}
```

Returns `404 DATASET_NOT_FOUND` when the dataset does not exist.

## Analyses

### `POST /api/v1/analyses`

Generates and validates a read-only query before executing it. Questions must be
between 5 and 2,000 characters.

```json
{
  "dataset_id": "dataset-id",
  "question": "Which schools had falling enrolment in the latest academic year?"
}
```

Returns `201 Created`:

```json
{
  "id": "analysis-id",
  "status": "completed",
  "question": "Which schools had falling enrolment in the latest academic year?",
  "answer": "The query returned 3 matching rows.",
  "sql": "SELECT ... LIMIT 500",
  "columns": ["school_name"],
  "rows": [{ "school_name": "North School" }],
  "warnings": [],
  "assumptions": [],
  "execution_ms": 45
}
```

`status` is `completed`, `abstained`, or `failed`. An abstention or query
execution failure is a valid analysis result and includes an explanation in
`answer` and, where applicable, `warnings`. Request errors include
`404 DATASET_NOT_FOUND`, `422 VALIDATION_ERROR`, and
`502 ANALYSIS_PROVIDER_ERROR`.

### `GET /api/v1/analyses/{analysis_id}`

Returns the saved analysis in the same shape as the create response. Returns
`404 ANALYSIS_NOT_FOUND` when the analysis does not exist.

## Error response

All API errors share this structure. `details` is included when field-level
request validation information is available.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid or missing fields.",
    "request_id": "a17f3bdb0e7b4e89b3eb17c7406e3e6d",
    "details": [
      {
        "field": "body.question",
        "message": "String should have at least 5 characters",
        "type": "string_too_short"
      }
    ]
  }
}
```

Clients should use `error.code` for programmatic handling, display `error.message`
to users, and retain `error.request_id` when reporting unexpected errors.
Internal exception details and database errors are not returned to clients.
