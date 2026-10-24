# Data model

Financial rows are tenant-keyed. Composite foreign keys ensure an entry and account belong to the same tenant. Codes are unique within each tenant; amounts use NUMERIC(19,4) and must be positive. Event and audit records are separate append-only tables. Database triggers reject deletion and mutation of financial history and validate posted entries at transaction commit. Tenant predicates come from authenticated claims.
