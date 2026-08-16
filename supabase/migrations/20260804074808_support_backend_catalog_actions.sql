create or replace function private.support_jsonb_text(p_value jsonb,p_key text,p_required boolean default false)
returns text language plpgsql immutable set search_path=''
as $$
declare v text;begin
  v:=nullif(btrim(p_value->>p_key),'');
  if p_required and v is null then raise exception 'Campo obrigatório ausente: %',p_key;end if;
  return v;
end$$;

create or replace function public.support_admin_save_queue_members(p_queue_id uuid,p_expected_version bigint,p_members jsonb,p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_queue public.support_queues%rowtype;v_member jsonb;v_user_id uuid;v_role text;v_capacity integer;v_keep_ids uuid[]:='{}'::uuid[];
begin
  if jsonb_typeof(p_members)<>'array' then raise exception 'A lista de membros deve ser um array.';end if;
  select * into v_queue from public.support_queues where id=p_queue_id for update;
  if not found then raise exception 'Fila não encontrada.';end if;
  if v_queue.version<>p_expected_version then raise exception 'CONFLICT: fila alterada por outro usuário.';end if;
  for v_member in select value from jsonb_array_elements(p_members) loop
    begin v_user_id:=(v_member->>'userId')::uuid;exception when others then raise exception 'Usuário inválido na lista de membros.';end;
    v_role:=coalesce(nullif(v_member->>'role',''),'agent');
    if v_role not in('manager','supervisor','agent','viewer') then raise exception 'Função inválida para membro da fila.';end if;
    v_capacity:=nullif(v_member->>'capacity','')::integer;
    if v_capacity is not null and(v_capacity<1 or v_capacity>100) then raise exception 'Capacidade inválida para membro da fila.';end if;
    insert into public.support_queue_members(queue_id,user_id,membership_role,capacity,status,created_by)
    values(p_queue_id,v_user_id,v_role,v_capacity,'active',p_actor_user_id)
    on conflict(queue_id,user_id) do update set membership_role=excluded.membership_role,capacity=excluded.capacity,status='active';
    v_keep_ids:=array_append(v_keep_ids,v_user_id);
  end loop;
  update public.support_queue_members set status='inactive' where queue_id=p_queue_id and status='active' and not(user_id=any(v_keep_ids));
  update public.support_queues set updated_by=p_actor_user_id where id=p_queue_id and version=p_expected_version;
  return jsonb_build_object('queueId',p_queue_id,'members',(select coalesce(jsonb_agg(to_jsonb(qm) order by qm.created_at),'[]'::jsonb) from public.support_queue_members qm where qm.queue_id=p_queue_id));
end$$;

create or replace function public.support_admin_save_form(p_payload jsonb,p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_form_id uuid;v_product_id uuid;v_legal_entity_id uuid;v_code text;v_name text;v_description text;v_status text;v_expected_version bigint;v_existing public.support_forms%rowtype;v_field jsonb;v_field_key text;v_field_type text;v_order integer;
begin
  begin v_product_id:=(p_payload->>'productId')::uuid;exception when others then raise exception 'Produto inválido.';end;
  v_legal_entity_id:=private.support_product_legal_entity_id(v_product_id);
  if v_legal_entity_id is null then raise exception 'Produto inexistente ou inativo.';end if;
  v_code:=upper(private.support_jsonb_text(p_payload,'code',true));
  if v_code!~'^[A-Z][A-Z0-9_]*$' then raise exception 'Código de formulário inválido.';end if;
  v_name:=private.support_jsonb_text(p_payload,'name',true);v_description:=private.support_jsonb_text(p_payload,'description',false);v_status:=coalesce(private.support_jsonb_text(p_payload,'status',false),'draft');
  if v_status not in('draft','active','archived') then raise exception 'Status de formulário inválido.';end if;
  if jsonb_typeof(coalesce(p_payload->'fields','[]'::jsonb))<>'array' then raise exception 'Campos do formulário devem ser um array.';end if;
  if nullif(p_payload->>'id','') is null then
    insert into public.support_forms(legal_entity_id,product_id,code,name,description,status,form_version,created_by,updated_by)
    values(v_legal_entity_id,v_product_id,v_code,v_name,v_description,v_status,1,p_actor_user_id,p_actor_user_id) returning id into v_form_id;
  else
    begin v_form_id:=(p_payload->>'id')::uuid;exception when others then raise exception 'Formulário inválido.';end;
    v_expected_version:=nullif(p_payload->>'expectedVersion','')::bigint;if v_expected_version is null then raise exception 'Versão esperada obrigatória.';end if;
    select * into v_existing from public.support_forms where id=v_form_id for update;
    if not found then raise exception 'Formulário não encontrado.';end if;
    if v_existing.product_id<>v_product_id then raise exception 'Formulário pertence a outro produto.';end if;
    if v_existing.version<>v_expected_version then raise exception 'CONFLICT: formulário alterado por outro usuário.';end if;
    update public.support_forms set code=v_code,name=v_name,description=v_description,status=v_status,updated_by=p_actor_user_id where id=v_form_id;
    delete from public.support_form_fields where form_id=v_form_id;
  end if;
  for v_field in select value from jsonb_array_elements(coalesce(p_payload->'fields','[]'::jsonb)) loop
    v_field_key:=lower(private.support_jsonb_text(v_field,'key',true));
    if v_field_key!~'^[a-z][a-z0-9_]*$' then raise exception 'Chave de campo inválida: %',v_field_key;end if;
    v_field_type:=private.support_jsonb_text(v_field,'type',true);
    if v_field_type not in('text','textarea','email','phone','number','date','datetime','select','multi_select','checkbox','radio','file') then raise exception 'Tipo de campo inválido: %',v_field_type;end if;
    v_order:=nullif(v_field->>'order','')::integer;if v_order is null or v_order<1 then raise exception 'Ordem de campo inválida.';end if;
    insert into public.support_form_fields(form_id,field_key,label,field_type,display_order,is_required,placeholder,help_text,default_value,validation_rules,options,display_condition,privacy_settings)
    values(v_form_id,v_field_key,private.support_jsonb_text(v_field,'label',true),v_field_type,v_order,coalesce((v_field->>'required')::boolean,false),private.support_jsonb_text(v_field,'placeholder',false),private.support_jsonb_text(v_field,'helpText',false),v_field->'defaultValue',coalesce(v_field->'validation','{}'::jsonb),coalesce(v_field->'options','[]'::jsonb),v_field->'displayCondition',coalesce(v_field->'privacy','{}'::jsonb));
  end loop;
  return jsonb_build_object('form',(select to_jsonb(f) from public.support_forms f where f.id=v_form_id),'fields',(select coalesce(jsonb_agg(to_jsonb(ff) order by ff.display_order),'[]'::jsonb) from public.support_form_fields ff where ff.form_id=v_form_id));
end$$;

revoke all on function private.support_jsonb_text(jsonb,text,boolean) from public,anon,authenticated;
revoke all on function public.support_admin_save_queue_members(uuid,bigint,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.support_admin_save_form(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.support_admin_save_queue_members(uuid,bigint,jsonb,uuid) to service_role;
grant execute on function public.support_admin_save_form(jsonb,uuid) to service_role;
