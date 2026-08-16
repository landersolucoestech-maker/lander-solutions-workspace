create or replace function private.ensure_document_draft()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
  v_status text;
  v_entry uuid;
begin
  v_id := case when tg_op='DELETE' then old.financial_document_id else new.financial_document_id end;
  select status,journal_entry_id into v_status,v_entry
  from public.financial_documents where id=v_id;
  if v_status <> 'draft' or v_entry is not null then
    raise exception 'Linhas só podem ser alteradas enquanto o documento permanece em rascunho.';
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;

create or replace function private.ensure_entry_editable()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
  v_status text;
  v_source text;
begin
  v_id := case when tg_op='DELETE' then old.journal_entry_id else new.journal_entry_id end;
  select status,source_type into v_status,v_source
  from public.journal_entries where id=v_id;
  if v_status <> 'draft' or v_source <> 'manual' then
    raise exception 'Partidas só podem ser alteradas em lançamento manual ainda em rascunho.';
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;

revoke all on function private.ensure_document_draft() from public,anon,authenticated;
revoke all on function private.ensure_entry_editable() from public,anon,authenticated;
