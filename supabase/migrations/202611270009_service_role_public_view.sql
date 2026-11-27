begin;

-- The stored public_view column (0007) is computed with redi_public_record, so every role that
-- writes redi_records must be able to execute it. Security-definer RPCs run as the owner, but the
-- service role (catalog import and publication scripts) writes the table directly.
grant execute on function public.redi_public_record(jsonb) to service_role;

notify pgrst,'reload schema';
commit;
