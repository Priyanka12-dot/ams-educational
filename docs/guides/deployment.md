# Deployment

## Local

Run `docker compose up --build` from the repository root. Compose starts PostgreSQL, the API, and the web UI. Set local secrets in an ignored `.env` file based on `.env.example` before starting services.

## Staging on Kubernetes

The CD workflow builds and pushes backend and frontend images to GitHub Container Registry after pushes to `main`. It deploys them only when the repository secret `STAGING_KUBECONFIG` is configured. Store the kubeconfig contents base64-encoded as that secret; the workflow writes it to a temporary runner file with restrictive permissions.

Before the first deployment, provision these resources in the cluster:

- Namespace `ams-staging` (also included in the manifest).
- Secret `ams-staging-secrets` in that namespace, containing every variable required by the backend `.env.example`, including database and signing keys.
- Image pull secret `ghcr-pull` in that namespace, authorized to pull the repository’s GHCR images.
- A PostgreSQL database reachable from the backend, with migrations applied and a least-privilege application role.
- An ingress or load balancer with TLS 1.2+ in front of the frontend and API. Configure cookie domain/origin and API routing for that host.

The manifest is in `deploy/kubernetes/staging.yaml`. After applying it, the workflow sets both deployments to the commit SHA image and waits for their rollout. The workflow does not create database credentials, GHCR credentials, or ingress/TLS resources. Enable platform encryption at rest and backups, and set `COOKIE_SECURE=true` in staging and production.
