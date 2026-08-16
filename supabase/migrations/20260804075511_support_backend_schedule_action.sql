create or replace function public.support_admin_save_business_hours(p_payload jsonb,p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_id uuid;v_product_id uuid;v_legal_entity_id uuid;v_expected bigint;v_existing public.support_business_hours%rowtype;v_interval jsonb;v_holiday jsonb;
begin
  v_product_id:=nullif(p_payload->>'productId','')::uuid;
  if v_product_id is null then begin v_legal_entity_id:=(p_payload->>'legalEntityId')::uuid;exception when others then raise exception 'Pessoa jurídica inválida.';end;
  else v_legal_entity_id:=private.support_product_legal_entity_id(v_product_id);if v_legal_entity_id is null then raise exception 'Produto inválido.';end if;end if;
  if jsonb_typeof(coalesce(p_payload->'intervals','[]'::jsonb))<>'array' then raise exception 'Intervalos devem ser um array.';end if;
  if jsonb_typeof(coalesce(p_payload->'holidays','[]'::jsonb))<>'array' then raise exception 'Feriados devem ser um array.';end if;
  if nullif(p_payload->>'id','') is null then
    insert into public.support_business_hours(legal_entity_id,product_id,name,timezone,is_24_hours,status,created_by,updated_by)
    values(v_legal_entity_id,v_product_id,private.support_jsonb_text(p_payload,'name',true),coalesce(private.support_jsonb_text(p_payload,'timezone',false),'America/Sao_Paulo'),coalesce((p_payload->>'is24Hours')::boolean,false),coalesce(private.support_jsonb_text(p_payload,'status',false),'active'),p_actor_user_id,p_actor_user_id) returning id into v_id;
  else
    begin v_id:=(p_payload->>'id')::uuid;exception when others then raise exception 'Calendário inválido.';end;
    v_expected:=nullif(p_payload->>'expectedVersion','')::bigint;if v_expected is null then raise exception 'Versão esperada obrigatória.';end if;
    select * into v_existing from public.support_business_hours where id=v_id for update;if not found then raise exception 'Calendário não encontrado.';end if;
    if v_existing.version<>v_expected then raise exception 'CONFLICT: calendário alterado por outro usuário.';end if;
    if v_existing.legal_entity_id<>v_legal_entity_id or v_existing.product_id is distinct from v_product_id then raise exception 'Calendário pertence a outro escopo.';end if;
    update public.support_business_hours set name=private.support_jsonb_text(p_payload,'name',true),timezone=coalesce(private.support_jsonb_text(p_payload,'timezone',false),'America/Sao_Paulo'),is_24_hours=coalesce((p_payload->>'is24Hours')::boolean,false),status=coalesce(private.support_jsonb_text(p_payload,'status',false),'active'),updated_by=p_actor_user_id where id=v_id;
    delete from public.support_business_hour_intervals where business_hours_id=v_id;
    delete from public.support_holidays where business_hours_id=v_id;
  end if;
  if not coalesce((p_payload->>'is24Hours')::boolean,false) then
    for v_interval in select value from jsonb_array_elements(coalesce(p_payload->'intervals','[]'::jsonb)) loop
      insert into public.support_business_hour_intervals(business_hours_id,weekday,starts_at,ends_at)
      values(v_id,(v_interval->>'weekday')::smallint,(v_interval->>'startsAt')::time,(v_interval->>'endsAt')::time);
    end loop;
  end if;
  for v_holiday in select value from jsonb_array_elements(coalesce(p_payload->'holidays','[]'::jsonb)) loop
    insert into public.support_holidays(business_hours_id,holiday_date,name,is_closed,special_starts_at,special_ends_at)
    values(v_id,(v_holiday->>'date')::date,private.support_jsonb_text(v_holiday,'name',true),coalesce((v_holiday->>'isClosed')::boolean,true),nullif(v_holiday->>'startsAt','')::time,nullif(v_holiday->>'endsAt','')::time);
  end loop;
  return jsonb_build_object('businessHours',(select to_jsonb(h) from public.support_business_hours h where h.id=v_id),'intervals',(select coalesce(jsonb_agg(to_jsonb(i) order by i.weekday,i.starts_at),'[]'::jsonb) from public.support_business_hour_intervals i where i.business_hours_id=v_id),'holidays',(select coalesce(jsonb_agg(to_jsonb(d) order by d.holiday_date),'[]'::jsonb) from public.support_holidays d where d.business_hours_id=v_id));
end$$;
revoke all on function public.support_admin_save_business_hours(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.support_admin_save_business_hours(jsonb,uuid) to service_role;
