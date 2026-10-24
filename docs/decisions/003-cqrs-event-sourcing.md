# ADR 003: CQRS and event log

Status: accepted. Commands validate and append entries; reports are read-side projections. The event log records committed transitions but does not reconstruct all state, so this is not full event sourcing.
