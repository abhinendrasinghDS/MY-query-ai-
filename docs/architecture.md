# Architecture

## Trust boundaries

1. Browser handles UI state and sends API requests.
2. FastAPI validates request payloads and dataset identifiers.
3. Source data is stored in a dedicated SQLite file per uploaded CSV; app metadata lives in a separate database.
4. Schema discovery creates a compact context for the local model.
5. The model produces a candidate query, never a trusted command.
6. SQLGlot policy checks single-statement read-only SQL and discovered-table allowlisting.
7. SQLite opens in URI read-only mode and sets `PRAGMA query_only`.
8. Results and warnings are returned with SQL and assumptions.

## Module boundaries

- `connectors`: source adapters
- `discovery`: schema inspection
- `profiling`: sample-based quality statistics
- `context`: compact model prompt construction
- `llm`: provider contract and Ollama adapter
- `sql`: policy enforcement
- `execution`: bounded execution
- `validation`: result/answerability checks
- `orchestration`: workflow coordination
- `observability`: sanitized stage timing
- `db`: app metadata models and session

## Next production increments

Add authenticated users and project membership, migration-based schema evolution, durable task queue, cancellation, robust semantic query verification, result provenance, secrets vault, and adapter-specific integration tests.
