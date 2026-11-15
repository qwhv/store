-- شغّل هذا الترحيل مرة واحدة في Supabase SQL Editor للمشروع الحالي.
alter table products add column if not exists out_of_stock boolean not null default false;
alter table stores add column if not exists owner_name text;
alter table stores add column if not exists whatsapp_phone text;

create table if not exists merchants (
  id bigint generated always as identity primary key,
  name text not null,
  product_types text,
  phone text,
  address text,
  created_at timestamptz default now()
);
create table if not exists brands (
  id bigint generated always as identity primary key,
  name text not null unique,
  description text,
  created_at timestamptz default now()
);
alter table categories add column if not exists parent_id bigint references categories(id) on delete set null;
alter table categories add column if not exists brand_id bigint references brands(id) on delete set null;
-- المنتجات القديمة تبقى بلا تاجر حتى يعيّن المدير المورد الصحيح من صفحة الإدارة.
alter table products add column if not exists merchant_id bigint references merchants(id) on delete restrict;
alter table products add column if not exists brand_id bigint references brands(id) on delete set null;
alter table products add column if not exists purchase_price numeric check (purchase_price is null or purchase_price >= 0);
alter table products add column if not exists sizes text[] not null default '{}';
alter table products add column if not exists colors text[] not null default '{}';

create or replace function require_product_merchant() returns trigger
language plpgsql as $$
begin
  if new.merchant_id is null then
    raise exception 'يجب ربط المنتج بتاجر أو مورد.' using errcode = '23502';
  end if;
  return new;
end;
$$;
drop trigger if exists require_product_merchant_before_insert on products;
create trigger require_product_merchant_before_insert before insert on products
for each row execute function require_product_merchant();

create table if not exists exchange_rates (
  id text primary key,
  sar_to_yer numeric not null check (sar_to_yer > 0)
);
alter table exchange_rates enable row level security;
drop policy if exists "read_exchange_rates" on exchange_rates;
create policy "read_exchange_rates" on exchange_rates for select using (true);
drop policy if exists "admin_exchange_rates" on exchange_rates;
create policy "admin_exchange_rates" on exchange_rates for all to authenticated using (true) with check (true);

alter table brands enable row level security;
drop policy if exists "read_brands" on brands;
create policy "read_brands" on brands for select using (true);
drop policy if exists "admin_brands" on brands;
create policy "admin_brands" on brands for all to authenticated using (true) with check (true);

alter table merchants enable row level security;
drop policy if exists "read_merchants_admin" on merchants;
create policy "read_merchants_admin" on merchants for select to authenticated using (true);
drop policy if exists "admin_merchants" on merchants;
create policy "admin_merchants" on merchants for all to authenticated using (true) with check (true);

-- واجهة المتجر لا تحتاج إلى سعر الشراء؛ تمنع الصلاحيات قراءته عبر API العام.
revoke select on products from anon;
grant select (id,category_id,store_id,brand_id,name,description,price,sale_price,
  sizes,colors,out_of_stock,rating,images,created_at) on products to anon;

create or replace function prevent_delete_container_with_products() returns trigger
language plpgsql as $$
begin
  if TG_TABLE_NAME = 'stores' and exists (select 1 from products where store_id = old.id) then
    raise exception 'لا يمكن حذف متجر يحتوي على منتجات. انقل المنتجات أو احذفها أولاً.' using errcode = '23503';
  elsif TG_TABLE_NAME = 'categories' and exists (select 1 from products where category_id = old.id) then
    raise exception 'لا يمكن حذف نوع يحتوي على منتجات. انقل المنتجات أو احذفها أولاً.' using errcode = '23503';
  end if;
  return old;
end;
$$;

drop trigger if exists protect_store_products on stores;
create trigger protect_store_products before delete on stores
for each row execute function prevent_delete_container_with_products();

drop trigger if exists protect_category_products on categories;
create trigger protect_category_products before delete on categories
for each row execute function prevent_delete_container_with_products();