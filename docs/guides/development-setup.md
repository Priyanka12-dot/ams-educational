# Development setup

Run `pnpm install`, `docker compose up -d db`, `pnpm db:migrate`, then `pnpm dev`. Unit tests are in `apps/backend/tests/unit`. The backend validates configuration at startup and requires a database URL plus two different signing secrets.
