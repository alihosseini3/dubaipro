-- Track the last delivery error for outbox dead-letter diagnostics.
ALTER TABLE "RfqEventOutbox" ADD COLUMN "lastError" VARCHAR(1000);
