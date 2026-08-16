alter function private.redact_contact_audit_row(jsonb, text) stable;
alter function private.hr_redact_row(text, jsonb) stable;

do $$
declare
  v_definition text;
  v_rewritten text;
begin
  select pg_get_functiondef('private.is_valid_cpf(text)'::regprocedure) into v_definition;
  v_rewritten := replace(v_definition, E'\n  i integer;', '');
  if v_rewritten = v_definition then
    raise exception 'Expected obsolete CPF loop variable was not found.';
  end if;
  execute v_rewritten;

  select pg_get_functiondef('private.is_valid_cnpj(text)'::regprocedure) into v_definition;
  v_rewritten := replace(v_definition, E'\n  i integer;', '');
  if v_rewritten = v_definition then
    raise exception 'Expected obsolete CNPJ loop variable was not found.';
  end if;
  execute v_rewritten;

  select pg_get_functiondef(
    'public.support_admin_save_automation_draft(uuid,bigint,jsonb,jsonb,uuid)'::regprocedure
  ) into v_definition;
  v_rewritten := replace(v_definition, ';v_product_id uuid;', ';');
  v_rewritten := replace(
    v_rewritten,
    E'\n  select product_id into v_product_id from public.support_automation_flows where id=v_version.flow_id;',
    ''
  );
  if v_rewritten = v_definition or position('v_product_id' in v_rewritten) > 0 then
    raise exception 'Expected obsolete Support variable was not removed cleanly.';
  end if;
  execute v_rewritten;

  select pg_get_functiondef(
    'public.run_allocation_workflow(text,uuid,integer,text,date)'::regprocedure
  ) into v_definition;
  v_rewritten := replace(v_definition, E'\n  v_index integer;', '');
  if v_rewritten = v_definition then
    raise exception 'Expected obsolete allocation loop variable was not found.';
  end if;
  execute v_rewritten;
end;
$$;
