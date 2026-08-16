begin;

create extension if not exists pgtap with schema extensions;

select plan(15);


select has_function(
  'public',
  'register_hr_document',
  array['uuid','uuid','text','text','text','text','bigint','date','date','text','text'],
  'caller-scoped employee document registration exists'
);
select has_function(
  'public',
  'delete_hr_document',
  array['uuid','bigint'],
  'caller-scoped employee document deletion exists'
);

select is(
  has_function_privilege(
    'anon',
    'public.register_hr_document(uuid,uuid,text,text,text,text,bigint,date,date,text,text)',
    'EXECUTE'
  ),
  false,
  'anonymous users cannot register employee documents'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.register_hr_document(uuid,uuid,text,text,text,text,bigint,date,date,text,text)',
    'EXECUTE'
  ),
  true,
  'authenticated users can reach caller-scoped employee document registration'
);
select is(
  has_function_privilege(
    'service_role',
    'public.register_hr_document(uuid,uuid,text,text,text,text,bigint,date,date,text,text)',
    'EXECUTE'
  ),
  false,
  'service role cannot bypass caller-scoped employee document registration'
);

select is(
  has_function_privilege(
    'anon',
    'public.delete_hr_document(uuid,bigint)',
    'EXECUTE'
  ),
  false,
  'anonymous users cannot delete employee documents'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.delete_hr_document(uuid,bigint)',
    'EXECUTE'
  ),
  true,
  'authenticated users can reach caller-scoped employee document deletion'
);
select is(
  has_function_privilege(
    'service_role',
    'public.delete_hr_document(uuid,bigint)',
    'EXECUTE'
  ),
  false,
  'service role cannot bypass caller-scoped employee document deletion'
);

select extensions.unalike(
  pg_get_functiondef(
    'public.register_hr_document(uuid,uuid,text,text,text,text,bigint,date,date,text,text)'::regprocedure
  ),
  '%p_actor_user_id%',
  'employee document registration does not accept a supplied actor id'
);
select extensions.unalike(
  pg_get_functiondef(
    'public.delete_hr_document(uuid,bigint)'::regprocedure
  ),
  '%p_actor_user_id%',
  'employee document deletion does not accept a supplied actor id'
);

select extensions.alike(
  pg_get_functiondef(
    'public.register_hr_document(uuid,uuid,text,text,text,text,bigint,date,date,text,text)'::regprocedure
  ),
  '%auth.uid()%',
  'employee document registration derives the actor from the session'
);
select extensions.alike(
  pg_get_functiondef(
    'public.delete_hr_document(uuid,bigint)'::regprocedure
  ),
  '%auth.uid()%',
  'employee document deletion derives the actor from the session'
);

select extensions.alike(
  pg_get_functiondef(
    'public.register_hr_document(uuid,uuid,text,text,text,text,bigint,date,date,text,text)'::regprocedure
  ),
  '%has_aal2()%',
  'employee document registration requires MFA aal2'
);
select extensions.alike(
  pg_get_functiondef(
    'public.delete_hr_document(uuid,bigint)'::regprocedure
  ),
  '%has_aal2()%',
  'employee document deletion requires MFA aal2'
);

select extensions.alike(
  pg_get_functiondef(
    'public.register_hr_document(uuid,uuid,text,text,text,text,bigint,date,date,text,text)'::regprocedure
  ),
  '%storage.objects%',
  'employee document registration verifies the uploaded Storage object'
);

select * from finish();

rollback;
