CREATE TYPE account_type AS ENUM ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE');
CREATE TYPE posting_direction AS ENUM ('DEBIT','CREDIT');
CREATE TYPE user_role AS ENUM ('ADMIN','ACCOUNTANT','AUDITOR','VIEWER');
CREATE TABLE tenants(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name varchar(120) NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),email varchar(320) NOT NULL,password_hash text NOT NULL,role user_role NOT NULL DEFAULT 'ADMIN',failed_login_count integer NOT NULL DEFAULT 0,locked_until timestamptz,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,email),UNIQUE(tenant_id,id),CHECK(failed_login_count>=0));
CREATE TABLE accounts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),code varchar(20) NOT NULL,name varchar(255) NOT NULL,type account_type NOT NULL,parent_id uuid,is_active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,code),UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,parent_id) REFERENCES accounts(tenant_id,id));
CREATE TABLE journal_entries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),entry_date date NOT NULL,description text NOT NULL,status varchar(12) NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','POSTED','REVERSED')),created_by uuid NOT NULL,reversal_of uuid,created_at timestamptz NOT NULL DEFAULT now(),posted_at timestamptz,UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,reversal_of) REFERENCES journal_entries(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES users(tenant_id,id));
CREATE TABLE postings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,journal_entry_id uuid NOT NULL,account_id uuid NOT NULL,amount numeric(19,4) NOT NULL CHECK(amount>0),direction posting_direction NOT NULL,FOREIGN KEY(tenant_id,journal_entry_id) REFERENCES journal_entries(tenant_id,id),FOREIGN KEY(tenant_id,account_id) REFERENCES accounts(tenant_id,id));
CREATE INDEX postings_entry_idx ON postings(tenant_id,journal_entry_id);
CREATE INDEX postings_account_idx ON postings(tenant_id,account_id);
CREATE INDEX journal_tenant_date_idx ON journal_entries(tenant_id,entry_date);
CREATE TABLE audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),user_id uuid,action varchar(80) NOT NULL,entity varchar(80) NOT NULL,entity_id uuid,metadata jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,user_id) REFERENCES users(tenant_id,id));
CREATE INDEX audit_tenant_time_idx ON audit_log(tenant_id,created_at);
CREATE TABLE refresh_tokens(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),user_id uuid NOT NULL,token_hash text NOT NULL UNIQUE,expires_at timestamptz NOT NULL,revoked_at timestamptz,replaced_by uuid,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,user_id) REFERENCES users(tenant_id,id));
CREATE TABLE event_log(sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,event_id uuid NOT NULL UNIQUE,tenant_id uuid NOT NULL REFERENCES tenants(id),aggregate_id uuid NOT NULL,event_type varchar(120) NOT NULL,payload jsonb NOT NULL,occurred_at timestamptz NOT NULL);
CREATE INDEX event_tenant_sequence_idx ON event_log(tenant_id,sequence);
CREATE FUNCTION prevent_financial_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Financial records are append-only; use a reversal.'; END $$;
CREATE TRIGGER no_delete_journal BEFORE DELETE ON journal_entries FOR EACH ROW EXECUTE FUNCTION prevent_financial_delete();
CREATE TRIGGER no_delete_postings BEFORE DELETE ON postings FOR EACH ROW EXECUTE FUNCTION prevent_financial_delete();
CREATE FUNCTION enforce_balanced_posted_entry() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_id uuid; entry_state text; debit_total numeric(19,4); credit_total numeric(19,4);
BEGIN
 target_id := COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
 SELECT status INTO entry_state FROM journal_entries WHERE id=target_id FOR UPDATE;
 IF entry_state='POSTED' THEN
   SELECT COALESCE(sum(amount) FILTER(WHERE direction='DEBIT'),0),COALESCE(sum(amount) FILTER(WHERE direction='CREDIT'),0) INTO debit_total,credit_total FROM postings WHERE journal_entry_id=target_id;
   IF debit_total<>credit_total OR (SELECT count(*) FROM postings WHERE journal_entry_id=target_id)<2 THEN RAISE EXCEPTION 'Posted journal entry must balance'; END IF;
 END IF;
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE CONSTRAINT TRIGGER balanced_posted_entry AFTER INSERT OR UPDATE ON journal_entries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_balanced_posted_entry();
CREATE FUNCTION prevent_posted_line_changes() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF (SELECT status FROM journal_entries WHERE id=COALESCE(OLD.journal_entry_id,NEW.journal_entry_id)) <> 'DRAFT' THEN RAISE EXCEPTION 'Posted journal lines are immutable'; END IF; RETURN COALESCE(NEW,OLD); END $$;
CREATE TRIGGER posted_lines_immutable BEFORE UPDATE OR DELETE ON postings FOR EACH ROW EXECUTE FUNCTION prevent_posted_line_changes();
CREATE TRIGGER posted_lines_no_insert BEFORE INSERT ON postings FOR EACH ROW EXECUTE FUNCTION prevent_posted_line_changes();
CREATE FUNCTION prevent_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Audit and event records are append-only'; END $$;
CREATE TRIGGER audit_no_update_delete BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
CREATE TRIGGER event_no_update_delete BEFORE UPDATE OR DELETE ON event_log FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

CREATE TRIGGER journal_no_truncate BEFORE TRUNCATE ON journal_entries FOR EACH STATEMENT EXECUTE FUNCTION prevent_financial_delete();
CREATE TRIGGER postings_no_truncate BEFORE TRUNCATE ON postings FOR EACH STATEMENT EXECUTE FUNCTION prevent_financial_delete();
CREATE TRIGGER audit_no_truncate BEFORE TRUNCATE ON audit_log FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_mutation();
CREATE TRIGGER event_no_truncate BEFORE TRUNCATE ON event_log FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_mutation();
