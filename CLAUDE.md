# Project rules

## Subagents / workflows: ask first, always

NEVER launch a subagent (Agent tool), workflow, or any multi-agent orchestration
without first:

1. Estimating the token cost for that specific use case, and
2. Stating that estimate to the user and getting explicit confirmation.

No exceptions. If confirmation isn't given, do the work single-threaded in the
main session.
