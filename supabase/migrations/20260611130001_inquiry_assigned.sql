-- Customer selects one provider after race completes.
ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS assigned_provider_id uuid REFERENCES users(id);
