create or replace function public.register_hr_document(
  p_employee_id uuid,
  p_document_type_id uuid,
  p_name text,
  p_storage_path text,
  p_original_file_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_issued_at date,
  p_expires_at date,
  p_notes text,
  p_visibility text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid := auth.uid();
  v_unit_code text;
  v_object_metadata jsonb;
  v_actual_size bigint;
  v_actual_mime text;
  v_document public.employee_documents;
begin
  if v_actor_user_id is null then
    raise exception 'Autenticação obrigatória.' using errcode = '42501';
  end if;

  if not public.has_aal2() then
    raise exception 'A operação exige MFA aal2.' using errcode = '42501';
  end if;

  v_unit_code := private.hr_employee_unit_code(p_employee_id);
  if v_unit_code is null then
    raise exception 'Colaborador não encontrado.' using errcode = 'P0002';
  end if;

  if not private.user_has_permission(
    v_actor_user_id,
    'hr.documents.manage',
    v_unit_code
  ) then
    raise exception 'Permissão insuficiente.' using errcode = '42501';
  end if;

  if btrim(coalesce(p_name, '')) = '' or char_length(p_name) > 250 then
    raise exception 'Nome do documento inválido.';
  end if;

  if btrim(coalesce(p_original_file_name, '')) = ''
     or char_length(p_original_file_name) > 500 then
    raise exception 'Nome original do arquivo inválido.';
  end if;

  if btrim(coalesce(p_storage_path, '')) = ''
     or char_length(p_storage_path) > 1000
     or p_storage_path not like p_employee_id::text || '/%' then
    raise exception 'Caminho de armazenamento inválido.';
  end if;

  if p_mime_type not in (
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) then
    raise exception 'Tipo de arquivo não permitido.';
  end if;

  if p_size_bytes is null or p_size_bytes < 1 or p_size_bytes > 52428800 then
    raise exception 'Tamanho de arquivo inválido.';
  end if;

  if char_length(coalesce(p_notes, '')) > 5000 then
    raise exception 'Observações excedem o limite permitido.';
  end if;

  select object.metadata
    into v_object_metadata
  from storage.objects object
  where object.bucket_id = 'hr-documents'
    and object.name = p_storage_path;

  if not found then
    raise exception 'Arquivo enviado não encontrado no armazenamento.' using errcode = 'P0002';
  end if;

  begin
    v_actual_size := nullif(v_object_metadata ->> 'size', '')::bigint;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Metadados de tamanho do arquivo são inválidos.';
  end;

  if v_actual_size is null or v_actual_size <> p_size_bytes then
    raise exception 'O tamanho informado não corresponde ao arquivo enviado.';
  end if;

  v_actual_mime := coalesce(
    nullif(v_object_metadata ->> 'mimetype', ''),
    nullif(v_object_metadata ->> 'contentType', ''),
    nullif(v_object_metadata ->> 'content-type', '')
  );

  if v_actual_mime is not null and v_actual_mime <> p_mime_type then
    raise exception 'O tipo MIME informado não corresponde ao arquivo enviado.';
  end if;

  begin
    insert into public.employee_documents (
      employee_id,
      document_type_id,
      name,
      storage_bucket,
      storage_path,
      original_file_name,
      mime_type,
      size_bytes,
      issued_at,
      expires_at,
      notes,
      visibility,
      status,
      uploaded_by,
      created_by,
      updated_by
    )
    values (
      p_employee_id,
      p_document_type_id,
      btrim(p_name),
      'hr-documents',
      p_storage_path,
      btrim(p_original_file_name),
      p_mime_type,
      p_size_bytes,
      p_issued_at,
      p_expires_at,
      nullif(btrim(p_notes), ''),
      p_visibility,
      'ACTIVE',
      v_actor_user_id,
      v_actor_user_id,
      v_actor_user_id
    )
    returning * into v_document;
  exception
    when unique_violation then
      raise exception 'Este arquivo já foi registrado.';
  end;

  return jsonb_build_object(
    'id', v_document.id,
    'status', v_document.status,
    'version', v_document.version
  );
end;
$function$;

create or replace function public.delete_hr_document(
  p_document_id uuid,
  p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid := auth.uid();
  v_unit_code text;
  v_document public.employee_documents;
begin
  if v_actor_user_id is null then
    raise exception 'Autenticação obrigatória.' using errcode = '42501';
  end if;

  if not public.has_aal2() then
    raise exception 'A operação exige MFA aal2.' using errcode = '42501';
  end if;

  select document.*
    into v_document
  from public.employee_documents document
  where document.id = p_document_id
    and document.deleted_at is null
    and document.status <> 'DELETED'
  for update;

  if not found then
    raise exception 'Documento não encontrado.' using errcode = 'P0002';
  end if;

  if v_document.version <> p_expected_version then
    raise exception 'O documento foi alterado por outro usuário.' using errcode = '40001';
  end if;

  v_unit_code := private.hr_employee_unit_code(v_document.employee_id);
  if v_unit_code is null then
    raise exception 'Colaborador não encontrado.' using errcode = 'P0002';
  end if;

  if not private.user_has_permission(
    v_actor_user_id,
    'hr.documents.manage',
    v_unit_code
  ) then
    raise exception 'Permissão insuficiente.' using errcode = '42501';
  end if;

  update public.employee_documents
  set status = 'DELETED',
      deleted_at = now(),
      updated_by = v_actor_user_id
  where id = p_document_id
  returning * into v_document;

  return jsonb_build_object(
    'id', v_document.id,
    'status', v_document.status,
    'version', v_document.version,
    'storage_bucket', v_document.storage_bucket,
    'storage_path', v_document.storage_path
  );
end;
$function$;

revoke all on function public.register_hr_document(
  uuid, uuid, text, text, text, text, bigint, date, date, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.delete_hr_document(uuid, bigint)
  from public, anon, authenticated, service_role;

grant execute on function public.register_hr_document(
  uuid, uuid, text, text, text, text, bigint, date, date, text, text
) to authenticated;
grant execute on function public.delete_hr_document(uuid, bigint)
  to authenticated;

comment on function public.register_hr_document(
  uuid, uuid, text, text, text, text, bigint, date, date, text, text
) is 'Caller-scoped employee document registration with MFA, unit authorization, and Storage object verification.';
comment on function public.delete_hr_document(uuid, bigint)
  is 'Caller-scoped logical employee document deletion with MFA, unit authorization, and optimistic concurrency.';
