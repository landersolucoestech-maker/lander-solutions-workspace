create or replace function public.support_admin_list_inbox(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_product_id uuid := (p_payload ->> 'productId')::uuid;
  v_page integer := greatest(coalesce((p_payload ->> 'page')::integer, 1), 1);
  v_size integer := least(greatest(coalesce((p_payload ->> 'pageSize')::integer, 50), 1), 100);
  v_offset integer := (v_page - 1) * v_size;
  v_queue_id uuid := nullif(p_payload ->> 'queueId', '')::uuid;
  v_agent_user_id uuid := nullif(p_payload ->> 'agentUserId', '')::uuid;
  v_channel_id uuid := nullif(p_payload ->> 'channelId', '')::uuid;
  v_category_id uuid := nullif(p_payload ->> 'categoryId', '')::uuid;
  v_sla_policy_id uuid := nullif(p_payload ->> 'slaPolicyId', '')::uuid;
  v_status text := nullif(p_payload ->> 'status', '');
  v_priority text := nullif(p_payload ->> 'priority', '');
  v_sla_state text := nullif(p_payload ->> 'slaState', '');
  v_search text := nullif(btrim(p_payload ->> 'search'), '');
  v_date_from timestamptz := nullif(p_payload ->> 'dateFrom', '')::timestamptz;
  v_date_to timestamptz := nullif(p_payload ->> 'dateTo', '')::timestamptz;
  v_unassigned boolean := coalesce((p_payload ->> 'unassigned')::boolean, false);
  v_rows jsonb;
  v_count bigint;
begin
  perform private.support_assert_product_scope(
    private.support_product_legal_entity_id(v_product_id),
    v_product_id
  );

  if v_status is not null and v_status not in (
    'new',
    'automation',
    'waiting_for_customer',
    'waiting_for_agent',
    'open',
    'pending',
    'resolved',
    'closed'
  ) then
    raise exception 'Status de conversa inválido.';
  end if;

  if v_priority is not null and v_priority not in (
    'low',
    'normal',
    'high',
    'urgent',
    'critical'
  ) then
    raise exception 'Prioridade inválida.';
  end if;

  if v_sla_state is not null and v_sla_state not in (
    'within_sla',
    'at_risk',
    'breached',
    'no_sla'
  ) then
    raise exception 'Estado de SLA inválido.';
  end if;

  if v_date_from is not null and v_date_to is not null and v_date_to < v_date_from then
    raise exception 'Período inválido.';
  end if;

  with filtered as (
    select c.id
    from public.support_conversations c
    join public.parties pt on pt.id = c.contact_party_id
    where c.product_id = v_product_id
      and (v_queue_id is null or c.current_queue_id = v_queue_id)
      and (v_agent_user_id is null or c.current_agent_user_id = v_agent_user_id)
      and (v_channel_id is null or c.channel_id = v_channel_id)
      and (v_status is null or c.status = v_status)
      and (v_priority is null or c.priority = v_priority)
      and (not v_unassigned or c.current_agent_user_id is null)
      and (v_date_from is null or c.last_activity_at >= v_date_from)
      and (v_date_to is null or c.last_activity_at <= v_date_to)
      and (
        v_search is null
        or coalesce(c.subject, '') ilike '%' || v_search || '%'
        or coalesce(c.last_message_preview, '') ilike '%' || v_search || '%'
        or coalesce(pt.trade_name, pt.legal_name, '') ilike '%' || v_search || '%'
      )
      and (
        v_category_id is null
        or exists (
          select 1
          from public.support_tickets t
          where t.conversation_id = c.id
            and (t.category_id = v_category_id or t.subcategory_id = v_category_id)
        )
      )
      and (
        v_sla_policy_id is null
        or exists (
          select 1
          from public.support_tickets t
          where t.conversation_id = c.id
            and t.sla_policy_id = v_sla_policy_id
        )
      )
      and (
        v_sla_state is null
        or (
          v_sla_state = 'no_sla'
          and not exists (
            select 1
            from public.support_tickets t
            where t.conversation_id = c.id
              and t.sla_policy_id is not null
          )
        )
        or (
          v_sla_state = 'breached'
          and exists (
            select 1
            from public.support_tickets t
            where t.conversation_id = c.id
              and t.status not in ('resolved', 'closed')
              and (
                (t.first_responded_at is null and t.first_response_due_at < now())
                or (t.resolved_at is null and t.resolution_due_at < now())
              )
          )
        )
        or (
          v_sla_state = 'at_risk'
          and exists (
            select 1
            from public.support_tickets t
            where t.conversation_id = c.id
              and t.status not in ('resolved', 'closed')
              and not (
                (t.first_responded_at is null and t.first_response_due_at < now())
                or (t.resolved_at is null and t.resolution_due_at < now())
              )
              and (
                (
                  t.first_responded_at is null
                  and t.first_response_due_at <= now() + interval '30 minutes'
                )
                or (
                  t.resolved_at is null
                  and t.resolution_due_at <= now() + interval '60 minutes'
                )
              )
          )
        )
        or (
          v_sla_state = 'within_sla'
          and exists (
            select 1
            from public.support_tickets t
            where t.conversation_id = c.id
              and t.sla_policy_id is not null
              and t.status not in ('resolved', 'closed')
              and (
                t.first_responded_at is not null
                or t.first_response_due_at > now() + interval '30 minutes'
              )
              and (
                t.resolved_at is not null
                or t.resolution_due_at > now() + interval '60 minutes'
              )
          )
        )
      )
  ),
  page_rows as (
    select
      c.*,
      jsonb_build_object(
        'id', pt.id,
        'name', coalesce(pt.trade_name, pt.legal_name)
      ) as contact,
      case
        when q.id is null then null
        else jsonb_build_object(
          'id', q.id,
          'name', q.name,
          'code', q.code
        )
      end as queue,
      case
        when pr.id is null then null
        else jsonb_build_object(
          'id', pr.id,
          'name', pr.display_name,
          'email', pr.email
        )
      end as agent,
      jsonb_build_object(
        'id', ch.id,
        'name', ch.name,
        'type', ch.channel_type,
        'status', ch.status
      ) as channel,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', t.id,
            'ticketNumber', t.ticket_number,
            'status', t.status,
            'priority', t.priority,
            'firstResponseDueAt', t.first_response_due_at,
            'resolutionDueAt', t.resolution_due_at
          )
          order by t.updated_at desc
        )
        from public.support_tickets t
        where t.conversation_id = c.id
      ), '[]'::jsonb) as tickets
    from filtered f
    join public.support_conversations c on c.id = f.id
    join public.parties pt on pt.id = c.contact_party_id
    join public.support_channels ch on ch.id = c.channel_id
    left join public.support_queues q on q.id = c.current_queue_id
    left join public.profiles pr on pr.id = c.current_agent_user_id
    order by c.last_activity_at desc
    limit v_size
    offset v_offset
  )
  select
    (select count(*) from filtered),
    coalesce(
      (
        select jsonb_agg(to_jsonb(page_rows) order by page_rows.last_activity_at desc)
        from page_rows
      ),
      '[]'::jsonb
    )
  into v_count, v_rows;

  return jsonb_build_object(
    'conversations', v_rows,
    'count', v_count,
    'page', v_page,
    'pageSize', v_size
  );
end
$$;
