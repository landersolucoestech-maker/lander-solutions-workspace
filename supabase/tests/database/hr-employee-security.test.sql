begin;

create extension if not exists pgtap with schema extensions;

select plan(16);


select has_function(
  'public','create_hr_employee',
  array[
    'text','text','text','date','text','text','text','text','text','text',
    'text','text','text','uuid','text','uuid','uuid','uuid','uuid','date',
    'text','text','text','text','text'
  ],
  'caller-scoped employee creation exists'
);
select has_function(
  'public','update_hr_employee',
  array[
    'uuid','bigint','bigint','text','text','date','text','text','text','text',
    'text','text','text','text','text','uuid','text','uuid','uuid','uuid',
    'uuid','date','text','text','text','text','text'
  ],
  'caller-scoped employee update exists'
);

select is(
  has_function_privilege(
    'anon',
    'public.create_hr_employee(text,text,text,date,text,text,text,text,text,text,text,text,text,uuid,text,uuid,uuid,uuid,uuid,date,text,text,text,text,text)',
    'EXECUTE'
  ),
  false,
  'anonymous users cannot create employees'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.create_hr_employee(text,text,text,date,text,text,text,text,text,text,text,text,text,uuid,text,uuid,uuid,uuid,uuid,date,text,text,text,text,text)',
    'EXECUTE'
  ),
  true,
  'authenticated users can reach caller-scoped employee creation'
);
select is(
  has_function_privilege(
    'service_role',
    'public.create_hr_employee(text,text,text,date,text,text,text,text,text,text,text,text,text,uuid,text,uuid,uuid,uuid,uuid,date,text,text,text,text,text)',
    'EXECUTE'
  ),
  false,
  'service role cannot bypass caller-scoped employee creation'
);

select is(
  has_function_privilege(
    'anon',
    'public.update_hr_employee(uuid,bigint,bigint,text,text,date,text,text,text,text,text,text,text,text,text,uuid,text,uuid,uuid,uuid,uuid,date,text,text,text,text,text)',
    'EXECUTE'
  ),
  false,
  'anonymous users cannot update employees'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.update_hr_employee(uuid,bigint,bigint,text,text,date,text,text,text,text,text,text,text,text,text,uuid,text,uuid,uuid,uuid,uuid,date,text,text,text,text,text)',
    'EXECUTE'
  ),
  true,
  'authenticated users can reach caller-scoped employee update'
);
select is(
  has_function_privilege(
    'service_role',
    'public.update_hr_employee(uuid,bigint,bigint,text,text,date,text,text,text,text,text,text,text,text,text,uuid,text,uuid,uuid,uuid,uuid,date,text,text,text,text,text)',
    'EXECUTE'
  ),
  false,
  'service role cannot bypass caller-scoped employee update'
);

select is(
  has_function_privilege(
    'anon',
    'public.admin_create_hr_employee(text,text,text,date,text,text,text,text,text,text,text,text,text,uuid,text,uuid,uuid,uuid,uuid,date,text,text,text,text,text,uuid)',
    'EXECUTE'
  ),
  false,
  'anonymous users cannot supply an employee creation actor'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.admin_create_hr_employee(text,text,text,date,text,text,text,text,text,text,text,text,text,uuid,text,uuid,uuid,uuid,uuid,date,text,text,text,text,text,uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated users cannot supply an employee creation actor'
);
select is(
  has_function_privilege(
    'service_role',
    'public.admin_create_hr_employee(text,text,text,date,text,text,text,text,text,text,text,text,text,uuid,text,uuid,uuid,uuid,uuid,date,text,text,text,text,text,uuid)',
    'EXECUTE'
  ),
  false,
  'service role cannot supply an employee creation actor'
);

select is(
  has_function_privilege(
    'anon',
    'public.admin_update_hr_employee(uuid,bigint,bigint,text,text,date,text,text,text,text,text,text,text,text,text,uuid,text,uuid,uuid,uuid,uuid,date,text,text,text,text,text,uuid)',
    'EXECUTE'
  ),
  false,
  'anonymous users cannot supply an employee update actor'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.admin_update_hr_employee(uuid,bigint,bigint,text,text,date,text,text,text,text,text,text,text,text,text,uuid,text,uuid,uuid,uuid,uuid,date,text,text,text,text,text,uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated users cannot supply an employee update actor'
);
select is(
  has_function_privilege(
    'service_role',
    'public.admin_update_hr_employee(uuid,bigint,bigint,text,text,date,text,text,text,text,text,text,text,text,text,uuid,text,uuid,uuid,uuid,uuid,date,text,text,text,text,text,uuid)',
    'EXECUTE'
  ),
  false,
  'service role cannot supply an employee update actor'
);

select extensions.unalike(
  pg_get_functiondef(
    'public.create_hr_employee(text,text,text,date,text,text,text,text,text,text,text,text,text,uuid,text,uuid,uuid,uuid,uuid,date,text,text,text,text,text)'::regprocedure
  ),
  '%p_actor_user_id%',
  'public employee creation does not accept a supplied actor id'
);
select extensions.unalike(
  pg_get_functiondef(
    'public.update_hr_employee(uuid,bigint,bigint,text,text,date,text,text,text,text,text,text,text,text,text,uuid,text,uuid,uuid,uuid,uuid,date,text,text,text,text,text)'::regprocedure
  ),
  '%p_actor_user_id%',
  'public employee update does not accept a supplied actor id'
);

select * from finish();

rollback;
