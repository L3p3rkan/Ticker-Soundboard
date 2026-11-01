---
name: Docker build compatibility
description: Container image choices for building this pnpm workspace reliably.
---

For Docker builds from this workspace, pin pnpm to the v10 line and use a glibc-based Node image such as `node:24-bookworm-slim`; Alpine/musl can lack the Rollup binary allowed by the workspace lockfile policy.

**Why:** Corepack's unpinned default selected pnpm 12 and rejected workspace dependency build scripts, and the first Alpine image could not load Rollup's excluded musl optional dependency.

**How to apply:** Use the project's pnpm v10 configuration in container builds and build frontend assets on Debian-based Node images; the runtime image can still be Alpine-based.
