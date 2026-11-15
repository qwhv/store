-- شغّل هذا الملف في Supabase > SQL Editor
create table stores (
  id bigint generated always as identity primary key,
  name text not null,
  description text,
  icon text default '🛍️',
  cover_url text,
  owner_name text,
  whatsapp_phone text,
  created_at timestamptz default now()
);
create table merchants (
  id bigint generated always as identity primary key,
  name text not null,
  product_types text,
  phone text,
  address text,
  created_at timestamptz default now()
);
create table brands (
  id bigint generated always as identity primary key,
  name text not null unique,
  description text,
  created_at timestamptz default now()
);
create table categories (
  id bigint generated always as identity primary key,
  store_id bigint not null references stores(id) on delete cascade,
  parent_id bigint references categories(id) on delete set null,
  brand_id bigint references brands(id) on delete set null,
  name text not null,
  created_at timestamptz default now()
);
create table products (
  id bigint generated always as identity primary key,
  category_id bigint not null references categories(id) on delete cascade,
  store_id bigint not null references stores(id) on delete cascade, -- مكرر لتسريع الاستعلام
  merchant_id bigint not null references merchants(id) on delete restrict,
  brand_id bigint references brands(id) on delete set null,
  name text not null,
  description text,
  price numeric not null,
  sale_price numeric,
  purchase_price numeric check (purchase_price is null or purchase_price >= 0),
  sizes text[] not null default '{}',
  colors text[] not null default '{}',
  out_of_stock boolean not null default false,
  rating numeric default 5,
  images text[] default '{}',
  created_at timestamptz default now()
);
create table reviews (
  id bigint generated always as identity primary key,
  product_id bigint not null references products(id) on delete cascade,
  customer_name text,
  rating int check (rating between 1 and 5),
  comment text,
  screenshot_url text,           -- صورة محادثة الواتساب (اختياري)
  source text default 'whatsapp',
  created_at timestamptz default now()
);
create table exchange_rates (
  id text primary key,
  sar_to_yer numeric not null check (sar_to_yer > 0)
);
-- منع حذف متجر أو نوع ما زال يحتوي على منتجات، مع السماح بحذف الحاويات الفارغة.
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
create trigger protect_store_products before delete on stores
for each row execute function prevent_delete_container_with_products();
create trigger protect_category_products before delete on categories
for each row execute function prevent_delete_container_with_products();
-- الأمان: القراءة للجميع، والإضافة للمدير المسجّل فقط (Supabase Auth)
alter table stores enable row level security;
alter table merchants enable row level security;
alter table brands enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table reviews enable row level security;
alter table exchange_rates enable row level security;
do $$ declare t text; begin
 foreach t in array array['stores','brands','categories','products','reviews','exchange_rates'] loop
  execute format('create policy "read_%1$s" on %1$s for select using (true)', t);
  execute format('create policy "admin_%1$s" on %1$s for all to authenticated using (true) with check (true)', t);
 end loop;
end $$;
create policy "read_merchants_admin" on merchants for select to authenticated using (true);
create policy "admin_merchants" on merchants for all to authenticated using (true) with check (true);
-- السماح للزوار بإضافة تقييم من الموقع
create policy "visitor_review" on reviews for insert to anon with check (source = 'site');
-- لا تسمح لزوار الموقع بقراءة سعر الشراء.
revoke select on products from anon;
grant select (id,category_id,store_id,brand_id,name,description,price,sale_price,
  sizes,colors,out_of_stock,rating,images,created_at) on products to anon;
