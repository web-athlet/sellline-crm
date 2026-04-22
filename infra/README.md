# infra

Local development stack:

- `postgres` — Postgres 15 with `pgvector` and `pg_trgm` (port 5432)
- `redis` — Redis 7 (port 6379)
- `minio` — S3-compatible storage (API 9000, console http://localhost:9001)
- `mailhog` — Dev SMTP (SMTP 1025, UI http://localhost:8025)

Default credentials in `/.env.example` — override via `/.env`.

```bash
pnpm docker:up    # start
pnpm docker:logs  # tail logs
pnpm docker:down  # stop
pnpm docker:nuke  # stop + delete volumes (destroys data)
```

The `init-scripts/` directory is mounted as `/docker-entrypoint-initdb.d`.
Scripts run **only on an empty volume** — recreate the volume (`docker:nuke`) to re-run.
