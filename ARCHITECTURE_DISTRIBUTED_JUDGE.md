## Distributed judge architecture (production)

### Goals
- Scale to **millions of users** with predictable latency.
- Preserve the current Arena UX while decoupling execution from the API.
- Strong isolation: **untrusted code** must not impact platform reliability.

### Target pipeline (queue-based)
\[
\text{submission} \rightarrow \text{API} \rightarrow \text{queue} \rightarrow \text{worker} \rightarrow \text{sandbox} \rightarrow \text{result store} \rightarrow \text{API/websocket poll}
\]

### Components
- **API service** (FastAPI)
  - Auth, problem metadata, submission creation, polling endpoints.
  - Writes submission rows to DB with `status=queued`.
  - Enqueues a job message: `{submission_id, problem_id, language, mode}`.
- **Queue**
  - Recommended: **Redis + Celery** for MVP (already present), migrate to **RabbitMQ/Kafka** later.
  - Separate queues:
    - `judge.run` (fast, low priority)
    - `judge.submit` (higher priority)
    - `judge.contest` (highest priority during contests)
- **Worker pool**
  - Stateless workers that pull from queue and execute jobs.
  - Autoscale horizontally.
  - No user sessions; all inputs loaded by `submission_id`.
- **Sandbox**
  - Docker container per job (or gVisor/Firecracker later).
  - Strict resource limits:
    - CPU quota, memory, pids, wall-clock timeout
    - network disabled
    - read-only filesystem
    - mount only problem bundle + temp dir
- **Result store**
  - Primary DB (Postgres/Supabase) holds final verdict + runtime + memory + case breakdown metadata.
  - Optional: object storage for large logs/artifacts.

### Execution model
- **Idempotency**
  - Job handler must be safe to retry. If `status` is already terminal, exit.
- **Leasing**
  - Worker marks `running` with `leased_until`; watchdog re-queues if expired.
- **Observability**
  - Structured logs: submission_id, problem_id, worker_id, elapsed_ms.
  - Metrics: queue depth, p95 latency, success rate, timeouts.

### Migration plan from current code
Current: inline thread fallback + Celery fallback, judge results stored in sqlite repository and partially mirrored to SQLAlchemy `user_submissions`.

Phased migration:
1. **Keep existing judge engine** unchanged (runner/comparator/parser).
2. Make **Celery the primary path** (disable inline execution in production via env).
3. Move submission persistence from sqlite `submissions` table → Postgres table (keep sqlite only for local dev).
4. Add worker leases + retries, then autoscaling.
5. Add websockets for real-time status (optional).

### Security checklist
- Drop all container capabilities.
- No network in sandbox.
- Enforce per-job tmpfs limits.
- Kill on timeout; always collect partial output.
- Rate limit submissions per user/IP.

