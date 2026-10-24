# Evaluation plan

## Correctness
- Create a fixed custom set of messy CSV/SQLite questions with expected output.
- Compare query execution results to expected answers, not SQL string equality alone.
- Include aggregation, joins, date comparisons, duplicates, nulls, category normalization, and unsupported questions.
- Measure execution accuracy, answerability precision/recall, and abstention quality.

## Safety
- Test DML/DDL, multiple statements, unknown tables, system catalogs, dangerous functions, expensive queries, and prompt-injection strings inside data.
- Confirm the source database remains unchanged after rejected queries.

## Reliability
- Test malformed model JSON, Ollama offline, timeouts, oversized files, empty CSVs, duplicate headers, and database failures.
- Record latency by pipeline stage and keep sensitive payloads out of logs.

## Model
Qwen3-8B is a configurable candidate, not a guaranteed best model. Benchmark the exact quantization, hardware, prompt, and dataset. Keep provider interfaces replaceable.
