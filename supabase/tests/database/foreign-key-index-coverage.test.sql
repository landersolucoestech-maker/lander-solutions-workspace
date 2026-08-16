begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

select is(
  (
    select count(*)::integer
    from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace nsp on nsp.oid=rel.relnamespace
    where con.contype='f'
      and nsp.nspname in ('public','private')
      and not exists (
        select 1
        from pg_index idx
        where idx.indrelid=con.conrelid
          and idx.indisvalid
          and idx.indisready
          and (idx.indkey::smallint[])[0:cardinality(con.conkey)-1]=con.conkey
      )
  ),
  0,
  'all application foreign keys have an ordered leading-key index'
);

create temp table fk_index_parent (
  key_a integer not null,
  key_b integer not null,
  primary key(key_a,key_b)
);

create temp table fk_index_child (
  id integer primary key,
  key_a integer not null,
  key_b integer not null,
  payload text,
  foreign key(key_a,key_b) references fk_index_parent(key_a,key_b)
);

create index fk_index_child_wrong_order_idx on fk_index_child(key_b,key_a);
create index fk_index_child_wrong_prefix_idx on fk_index_child(payload,key_a,key_b);

select is(
  (
    select count(*)::integer
    from pg_constraint con
    where con.contype='f'
      and con.conrelid='fk_index_child'::regclass
      and exists (
        select 1 from pg_index idx
        where idx.indrelid=con.conrelid
          and idx.indisvalid and idx.indisready
          and (idx.indkey::smallint[])[0:cardinality(con.conkey)-1]=con.conkey
      )
  ),
  0,
  'reversed FK columns and non-leading FK columns are rejected'
);

create index fk_index_child_cover_idx on fk_index_child(key_a,key_b,payload);

select is(
  (
    select count(*)::integer
    from pg_constraint con
    where con.contype='f'
      and con.conrelid='fk_index_child'::regclass
      and exists (
        select 1 from pg_index idx
        where idx.indrelid=con.conrelid
          and idx.indisvalid and idx.indisready
          and (idx.indkey::smallint[])[0:cardinality(con.conkey)-1]=con.conkey
      )
  ),
  1,
  'an ordered FK prefix in a wider composite index is accepted'
);

create temp table fk_single_parent (id integer primary key);
create temp table fk_partial_child (
  id integer primary key,
  parent_id integer references fk_single_parent(id)
);
create index fk_partial_child_parent_idx
  on fk_partial_child(parent_id) where parent_id is not null;

select is(
  (
    select count(*)::integer
    from pg_constraint con
    where con.contype='f'
      and con.conrelid='fk_partial_child'::regclass
      and exists (
        select 1 from pg_index idx
        where idx.indrelid=con.conrelid
          and idx.indisvalid and idx.indisready
          and (idx.indkey::smallint[])[0:cardinality(con.conkey)-1]=con.conkey
      )
  ),
  1,
  'a nullable FK is covered by its IS NOT NULL partial index'
);

create temp table fk_primary_child (
  parent_id integer primary key references fk_single_parent(id)
);

select is(
  (
    select count(*)::integer
    from pg_constraint con
    where con.contype='f'
      and con.conrelid='fk_primary_child'::regclass
      and exists (
        select 1 from pg_index idx
        where idx.indrelid=con.conrelid
          and idx.indisvalid and idx.indisready
          and (idx.indkey::smallint[])[0:cardinality(con.conkey)-1]=con.conkey
      )
  ),
  1,
  'a child primary key also covers its same-column FK'
);

select ok(
  exists (
    select 1
    from pg_index idx
    where idx.indrelid='fk_partial_child'::regclass
      and idx.indpred is not null
  ),
  'partial-index coverage is exercised rather than treated as a full index'
);

select * from finish();

rollback;
