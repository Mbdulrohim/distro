-- Recipient batch positions must mirror the deterministic 379-recipient
-- execution plan. Existing pre-fix drafts stored every row in batch zero,
-- which made results after the first transaction impossible to reconcile.
-- Only untouched drafts are rebucketed; settled history is preserved.
with numbered as (
  select r.id,
         ((row_number() over (partition by r.distribution_id order by r.index_in_batch) - 1) / 379)::integer as batch_index,
         ((row_number() over (partition by r.distribution_id order by r.index_in_batch) - 1) % 379)::integer as index_in_batch
  from recipients r
  join distributions d on d.id = r.distribution_id
  where r.batch_index = 0
    and not exists (
      select 1 from distribution_transactions t where t.distribution_id = r.distribution_id
    )
)
update recipients r
set batch_index = numbered.batch_index,
    index_in_batch = numbered.index_in_batch
from numbered
where r.id = numbered.id;
