begin;

create extension if not exists pgtap with schema extensions;

select plan(21);


select has_function(
  'public',
  'create_hr_contract',
  array[
    'uuid','uuid','uuid','text','date','date','numeric','text','text','text',
    'text','text','text','text','boolean'
  ],
  'caller-scoped employment contract creation exists'
);
select has_function(
  'public',
  'update_hr_contract',
  array[
    'uuid','bigint','uuid','text','date','date','numeric','text','text','text',
    'text','text','text','text','boolean'
  ],
  'caller-scoped employment contract update exists'
);
select has_function(
  'public',
  'close_hr_contract',
  array['uuid','date','bigint'],
  'caller-scoped employment contract closing exists'
);

select is(
  has_function_privilege(
    'anon',
    'public.create_hr_contract(uuid,uuid,uuid,text,date,date,numeric,text,text,text,text,text,text,text,boolean)',
    'EXECUTE'
  ),
  false,
  'anonymous users cannot create employment contracts'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.create_hr_contract(uuid,uuid,uuid,text,date,date,numeric,text,text,text,text,text,text,text,boolean)',
    'EXECUTE'
  ),
  true,
  'authenticated users can reach caller-scoped employment contract creation'
);
select is(
  has_function_privilege(
    'service_role',
    'public.create_hr_contract(uuid,uuid,uuid,text,date,date,numeric,text,text,text,text,text,text,text,boolean)',
    'EXECUTE'
  ),
  false,
  'service role cannot bypass caller-scoped employment contract creation'
);

select is(
  has_function_privilege(
    'anon',
    'public.update_hr_contract(uuid,bigint,uuid,text,date,date,numeric,text,text,text,text,text,text,text,boolean)',
    'EXECUTE'
  ),
  false,
  'anonymous users cannot update employment contracts'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.update_hr_contract(uuid,bigint,uuid,text,date,date,numeric,text,text,text,text,text,text,text,boolean)',
    'EXECUTE'
  ),
  true,
  'authenticated users can reach caller-scoped employment contract updates'
);
select is(
  has_function_privilege(
    'service_role',
    'public.update_hr_contract(uuid,bigint,uuid,text,date,date,numeric,text,text,text,text,text,text,text,boolean)',
    'EXECUTE'
  ),
  false,
  'service role cannot bypass caller-scoped employment contract updates'
);

select is(
  has_function_privilege(
    'anon',
    'public.close_hr_contract(uuid,date,bigint)',
    'EXECUTE'
  ),
  false,
  'anonymous users cannot close employment contracts'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.close_hr_contract(uuid,date,bigint)',
    'EXECUTE'
  ),
  true,
  'authenticated users can reach caller-scoped employment contract closing'
);
select is(
  has_function_privilege(
    'service_role',
    'public.close_hr_contract(uuid,date,bigint)',
    'EXECUTE'
  ),
  false,
  'service role cannot bypass caller-scoped employment contract closing'
);

select extensions.unalike(
  pg_get_functiondef(
    'public.create_hr_contract(uuid,uuid,uuid,text,date,date,numeric,text,text,text,text,text,text,text,boolean)'::regprocedure
  ),
  '%p_actor_user_id%',
  'employment contract creation does not accept a supplied actor id'
);
select extensions.unalike(
  pg_get_functiondef(
    'public.update_hr_contract(uuid,bigint,uuid,text,date,date,numeric,text,text,text,text,text,text,text,boolean)'::regprocedure
  ),
  '%p_actor_user_id%',
  'employment contract update does not accept a supplied actor id'
);
select extensions.unalike(
  pg_get_functiondef(
    'public.close_hr_contract(uuid,date,bigint)'::regprocedure
  ),
  '%p_actor_user_id%',
  'employment contract closing does not accept a supplied actor id'
);

select extensions.alike(
  pg_get_functiondef(
    'public.create_hr_contract(uuid,uuid,uuid,text,date,date,numeric,text,text,text,text,text,text,text,boolean)'::regprocedure
  ),
  '%auth.uid()%',
  'employment contract creation derives the actor from the session'
);
select extensions.alike(
  pg_get_functiondef(
    'public.update_hr_contract(uuid,bigint,uuid,text,date,date,numeric,text,text,text,text,text,text,text,boolean)'::regprocedure
  ),
  '%auth.uid()%',
  'employment contract update derives the actor from the session'
);
select extensions.alike(
  pg_get_functiondef(
    'public.close_hr_contract(uuid,date,bigint)'::regprocedure
  ),
  '%auth.uid()%',
  'employment contract closing derives the actor from the session'
);

select extensions.alike(
  pg_get_functiondef(
    'public.create_hr_contract(uuid,uuid,uuid,text,date,date,numeric,text,text,text,text,text,text,text,boolean)'::regprocedure
  ),
  '%has_aal2()%',
  'employment contract creation requires MFA aal2'
);
select extensions.alike(
  pg_get_functiondef(
    'public.update_hr_contract(uuid,bigint,uuid,text,date,date,numeric,text,text,text,text,text,text,text,boolean)'::regprocedure
  ),
  '%has_aal2()%',
  'employment contract update requires MFA aal2'
);
select extensions.alike(
  pg_get_functiondef(
    'public.close_hr_contract(uuid,date,bigint)'::regprocedure
  ),
  '%has_aal2()%',
  'employment contract closing requires MFA aal2'
);

select * from finish();

rollback;
