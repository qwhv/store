const app=document.getElementById('app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let productBrandReturnView=null;
function goBack(fallback){
 if(window.history.length>1){window.history.back();return}
 location.hash=fallback;
}
function openProductBrand(storeId,brandId,productId){
 productBrandReturnView=String(activeStoreId)===String(storeId)?{
  storeId:activeStoreId,filterType:activeStoreFilterType,categoryId:activeStoreCategoryId,brandId:activeStoreBrandId
 }:null;
 location.hash=`#/store/${Number(storeId)}/brand/${Number(brandId)}/${Number(productId)}`;
}
function setTheme(theme){
 document.documentElement.dataset.theme=theme;
 localStorage.setItem('mkym_theme',theme);
 const button=document.getElementById('themeBtn');
 button.textContent=theme==='dark'?'الوضع الداكن ☼':'الوضع الفاتح ☾';
}
function toggleTheme(){setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark')}
setTheme(localStorage.getItem('mkym_theme')||'dark');
let sarToYerRate=null;
let currency=localStorage.getItem('mkym_currency')==='SAR'?'SAR':'YER';
const EXCHANGE_RATE_CACHE_KEY='mkym_exchange_rate';
const EXCHANGE_RATE_CACHE_TTL=60*60*1000;
let hasFreshExchangeRateCache=false;
try{
 const cached=JSON.parse(localStorage.getItem(EXCHANGE_RATE_CACHE_KEY)||'null');
 const cacheAge=Date.now()-Number(cached?.cachedAt);
 if(cached&&cacheAge>=0&&cacheAge<EXCHANGE_RATE_CACHE_TTL&&Number(cached.rate)>0){
  sarToYerRate=Number(cached.rate);
  hasFreshExchangeRateCache=true;
 }
}catch(error){
 console.warn('تعذر قراءة سعر الصرف المحفوظ.',error);
 localStorage.removeItem(EXCHANGE_RATE_CACHE_KEY);
}
const currencyName=()=>currency==='SAR'?'ر.س':'ر.ي';
const money=n=>{
 const amount=currency==='SAR'&&sarToYerRate>0?Number(n)/sarToYerRate:Number(n);
 return amount.toLocaleString('ar-EG',currency==='SAR'?{minimumFractionDigits:2,maximumFractionDigits:2}:undefined)+' '+currencyName();
};
function updateExchangeRateUI(){
 if(!(sarToYerRate>0)&&currency==='SAR'){
  currency='YER';
  localStorage.setItem('mkym_currency',currency);
 }
 const select=document.getElementById('currencySelect');
 select.value=currency;
 select.querySelector('option[value="SAR"]').disabled=!(sarToYerRate>0);
 document.getElementById('exchangeRateInfo').textContent=sarToYerRate
  ?`سعر الصرف: 1 ر.س = ${moneyInYER(sarToYerRate)}`
  :'لم يحدد سعر الصرف السعودي بعد.';
 refreshPrices();
}
async function loadExchangeRate(){
 if(hasFreshExchangeRateCache){
  updateExchangeRateUI();
  return;
 }
 let setting=null;
 try{setting=await DB.get('exchange_rates','sar')}catch(error){
  if(error?.code==='PGRST205')throw new Error('جدول سعر الصرف غير موجود في قاعدة البيانات.');
  throw error;
 }
 sarToYerRate=Number(setting?.sar_to_yer)||null;
 if(sarToYerRate>0){
  localStorage.setItem(EXCHANGE_RATE_CACHE_KEY,JSON.stringify({rate:sarToYerRate,cachedAt:Date.now()}));
  hasFreshExchangeRateCache=true;
 }else{
  localStorage.removeItem(EXCHANGE_RATE_CACHE_KEY);
  hasFreshExchangeRateCache=false;
 }
 updateExchangeRateUI();
}
const moneyInYER=n=>Number(n).toLocaleString('ar-EG')+' ر.ي';
function refreshPrices(){
 document.querySelectorAll('[data-price]').forEach(element=>{
  element.textContent=money(Number(element.dataset.price));
 });
}
function setCurrency(value){
 if(value==='SAR'&&!(sarToYerRate>0))return;
 currency=value==='SAR'?'SAR':'YER';
 localStorage.setItem('mkym_currency',currency);
 refreshPrices();
}
function toggleSettingsPanel(force){
 const panel=document.getElementById('settingsPanel');
 const open=force??!panel.classList.contains('open');
 panel.classList.toggle('open',open);
 panel.setAttribute('aria-hidden',String(!open));
 document.getElementById('settingsBackdrop').hidden=!open;
 document.getElementById('settingsBtn').setAttribute('aria-expanded',String(open));
}
function toggleStoreFilterPanel(force){
 const panel=document.getElementById('storeFilterPanel');
 const open=force??!panel.classList.contains('open');
 panel.classList.toggle('open',open);
 panel.setAttribute('aria-hidden',String(!open));
 document.getElementById('storeFilterBackdrop').hidden=!open;
 document.getElementById('storeFilterBtn').setAttribute('aria-expanded',String(open));
}
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'){toggleSettingsPanel(false);toggleStoreFilterPanel(false)}
});
const eff=p=>p.sale_price||p.price;
const phoneDigits=phone=>String(phone||'').replace(/\D/g,'');
const storeWhatsApp=(store,text='')=>{
 const phone=phoneDigits(store?.whatsapp_phone);
 return phone.length>=8&&phone.length<=15?`https://wa.me/${phone}${text?`?text=${encodeURIComponent(text)}`:''}`:'';
};
const inquiry=(p,store)=>storeWhatsApp(store,`مرحباً، أستفسر عن توفر المنتج: ${p.name} (رقم ${p.id})`);
const stars=r=>{r=Math.max(0,Math.min(5,Math.round(Number(r)||0)));return '★'.repeat(r)+'☆'.repeat(5-r)};
const img=p=>esc((p.images&&p.images[0])||'');
const normalizeSearch=value=>String(value||'').trim().toLocaleLowerCase();
let cart=JSON.parse(localStorage.getItem('mkym_cart')||'[]');
async function hydrateCart(){
 if(!cart.length)return;
 let products,stores;
 if(sb){
  const {data:productData,error:productError}=await sb.from('products')
   .select('id,name,price,sale_price,images,out_of_stock,store_id').in('id',cart.map(c=>c.id));
  if(productError)throw productError;
  products=productData;
  const storeIds=[...new Set(products.map(product=>product.store_id))];
  if(storeIds.length){
   const {data:storeData,error:storeError}=await sb.from('stores')
    .select('id,name,owner_name,whatsapp_phone').in('id',storeIds);
   if(storeError)throw storeError;
   stores=storeData;
  }else stores=[];
 }else{
  [products,stores]=await Promise.all([DB.list('products'),DB.list('stores')]);
 }
 for(const item of cart){
  const product=products.find(p=>String(p.id)===String(item.id));
  if(!product)throw new Error(`تعذر العثور على المنتج رقم ${item.id} الموجود في السلة.`);
  const store=stores.find(s=>String(s.id)===String(product.store_id));
  if(!store)throw new Error(`تعذر العثور على متجر المنتج ${product.name}.`);
  Object.assign(item,{store_id:store.id,store_name:store.name,owner_name:store.owner_name||'',whatsapp_phone:store.whatsapp_phone||''});
 }
 localStorage.setItem('mkym_cart',JSON.stringify(cart));
}
const cartReady=hydrateCart();
function card(p,i=0){
 const off=p.sale_price?Math.round(100-p.sale_price/p.price*100):0;
 return `<a class="card" style="animation-delay:${i*60}ms" href="#/product/${p.id}">
 ${off?`<span class="badge">-${off}%</span>`:''}${p.out_of_stock?'<span class="stockout">انتهاء الكمية</span>':''}<img src="${img(p)}" alt="" loading="lazy" decoding="async" width="300" height="300">
 <div class="in"><h4>${esc(p.name)}</h4><div class="st">${stars(p.rating)}</div>
 <span class="pr" data-price="${eff(p)}">${money(eff(p))}</span>${p.sale_price?`<span class="old" data-price="${p.price}">${money(p.price)}</span>`:''}</div></a>`;
}
function storeCard(store){
 return `<a class="store" href="#/store/${store.id}">
 <div class="ic">${esc(store.icon||'🛍️')}</div><h3 style="margin-top:10px">${esc(store.name)}</h3>
 ${store.owner_name?`<p class="store-owner-name">بإدارة ${esc(store.owner_name)}</p>`:''}
 <p style="color:var(--m);margin-top:6px">${esc(store.description)}</p><span class="btn">ادخل المتجر ←</span></a>`;
}
let homepageStores=[],homepageQuery='';
let activeStoreId='',activeStoreProducts=[],activeProductQuery='';
let activeStoreCategories=[],activeStoreBrands=[],activeStoreBrandId='',activeStoreFilterType='all',activeStoreCategoryId='';
let activeStoreAllProducts=[],activeStoreProductBrandId=()=>null,activeStoreSourceProductId='';
const categoryDescendants=(categories,id)=>categories.filter(category=>String(category.parent_id)===String(id))
 .flatMap(category=>[category.id,...categoryDescendants(categories,category.id)]);
function categoryButtons(categories,parentId=null,depth=0,selectedId=''){
 return categories.filter(category=>parentId===null?!category.parent_id:String(category.parent_id)===String(parentId))
  .map(category=>`<button class="filter-item ${String(selectedId)===String(category.id)?'on':''}" style="padding-inline-start:${12+depth*14}px" onclick="selectStoreFilter('category',${Number(category.id)})">${esc(category.name)}</button>${categoryButtons(categories,category.id,depth+1,selectedId)}`).join('');
}
function renderStoreFilters(){
 const content=document.getElementById('storeFilterContent');
 if(!content)return;
 content.innerHTML=`<button class="filter-choice ${activeStoreFilterType==='home'?'on':''}" onclick="selectStoreFilter('home')">الصفحة الرئيسية</button>
 <button class="filter-choice ${activeStoreFilterType==='all'?'on':''}" onclick="selectStoreFilter('all')">كل المنتجات</button>
 <details class="filter-group" ${activeStoreFilterType==='category'?'open':''}><summary>الأنواع</summary><div class="filter-items">${activeStoreCategories.length?categoryButtons(activeStoreCategories,null,0,activeStoreCategoryId):'<p class="filter-empty">لا توجد أنواع لهذا المتجر.</p>'}</div></details>
 <details class="filter-group" ${activeStoreFilterType==='brand'?'open':''}><summary>البرندات</summary><div class="filter-items">${activeStoreBrands.length?activeStoreBrands.map(brand=>`<button class="filter-item ${activeStoreFilterType==='brand'&&String(activeStoreBrandId)===String(brand.id)?'on':''}" onclick="selectStoreFilter('brand',${Number(brand.id)})">${esc(brand.name)}</button>`).join(''):'<p class="filter-empty">لا توجد برندات لهذا المتجر.</p>'}</div></details>`;
}
function selectStoreFilter(type,id=''){
 productBrandReturnView=null;
 activeStoreSourceProductId='';
 activeStoreFilterType=type;
 activeStoreCategoryId=type==='category'?String(id):'';
 activeStoreBrandId=type==='brand'?String(id):'';
 const categoryIds=type==='category'?[Number(id),...categoryDescendants(activeStoreCategories,id)]:null;
 activeStoreProducts=type==='category'
  ?activeStoreAllProducts.filter(product=>categoryIds.includes(Number(product.category_id)))
  :type==='brand'?activeStoreAllProducts.filter(product=>String(activeStoreProductBrandId(product))===String(id)):activeStoreAllProducts.slice();
 renderStoreFilters();
 renderStoreProducts();
 renderStoreBack();
 toggleStoreFilterPanel(false);
}
function renderStoreBack(){
 const container=document.getElementById('storeBack');
 if(!container)return;
 container.innerHTML=activeStoreSourceProductId
  ?`<button class="back-action" type="button" onclick="goBack('#/product/${Number(activeStoreSourceProductId)}')">→ العودة إلى المنتج</button>`
  :activeStoreFilterType==='home'
   ?'<a class="back" href="#/">→ المتاجر</a>'
   :'<button class="back-action" type="button" onclick="selectStoreFilter(\'home\')">→ الصفحة الرئيسية</button>';
}
function restoreStoreView(view){
 activeStoreId=view.storeId;
 activeStoreFilterType=view.filterType;
 activeStoreCategoryId=view.categoryId;
 activeStoreBrandId=view.brandId;
 const categoryIds=view.filterType==='category'
  ?[Number(view.categoryId),...categoryDescendants(activeStoreCategories,view.categoryId)]:null;
 activeStoreProducts=view.filterType==='category'
  ?activeStoreAllProducts.filter(product=>categoryIds.includes(Number(product.category_id)))
  :view.filterType==='brand'
   ?activeStoreAllProducts.filter(product=>String(activeStoreProductBrandId(product))===String(view.brandId))
   :activeStoreAllProducts.slice();
}
function renderHomepageStores(){
 const query=normalizeSearch(homepageQuery);
 const matches=homepageStores.filter(store=>normalizeSearch(`${store.name} ${store.description}`).includes(query));
 const grid=document.getElementById('storeList');
 if(grid)grid.innerHTML=matches.length?matches.map(storeCard).join(''):'<p class="search-empty">لا توجد متاجر تطابق بحثك.</p>';
}
function searchStores(value){homepageQuery=value;renderHomepageStores()}
function renderStoreProducts(){
 const container=document.getElementById('storeProducts');
 if(!container)return;
 const query=normalizeSearch(activeProductQuery);
 if(query){
  const matches=activeStoreProducts.filter(product=>normalizeSearch(`${product.name} ${product.description}`).includes(query));
  container.innerHTML=matches.length?`<h2>نتائج البحث (${matches.length})</h2><div class="grid">${matches.map(card).join('')}</div>`:'<p class="search-empty">لا توجد منتجات تطابق بحثك.</p>';
  return;
 }
 if(activeStoreFilterType==='home'){
  const offers=activeStoreAllProducts.filter(product=>product.sale_price).slice(0,5);
  const fresh=activeStoreAllProducts.slice(0,5);
  const section=(title,products)=>products.length?`<h2>${title}</h2><div class="product-strip">${products.map(card).join('')}</div>`:'';
  container.innerHTML=activeStoreAllProducts.length
   ?`${section('🔥 العروض والترندات',offers)}${section('🆕 أضيف حديثاً',fresh)}`
   :'<p class="search-empty">لا توجد منتجات بعد.</p>';
  return;
 }
 const selectedBrand=activeStoreBrands.find(brand=>String(brand.id)===String(activeStoreBrandId));
 const title=activeStoreFilterType==='category'?'منتجات النوع المحدد':activeStoreFilterType==='brand'?`منتجات ${selectedBrand?.name||'البرند المحدد'}`:'جميع المنتجات';
 container.innerHTML=activeStoreProducts.length?`<h2>${title}</h2><div class="grid">${activeStoreProducts.map(card).join('')}</div>`:'<p class="search-empty">لا توجد منتجات في هذا الاختيار.</p>';
}
function searchProducts(value){activeProductQuery=value;renderStoreProducts()}
async function route(){
 window.scrollTo(0,0);
 const [,pg,id,subpage,subId,sourceProductId]=location.hash.split('/');
 if(productBrandReturnView&&pg==='product')restoreStoreView(productBrandReturnView);
 else if(productBrandReturnView&&pg==='store'&&!subpage&&String(id)===String(productBrandReturnView.storeId)){
  restoreStoreView(productBrandReturnView);
  productBrandReturnView=null;
 }
 if(pg!=='store'&&pg!=='product'){activeStoreId='';productBrandReturnView=null}
 document.getElementById('storeFilterBtn').hidden=pg!=='store';
 toggleStoreFilterPanel(false);
 app.innerHTML='<div class="wrap">جارٍ التحميل...</div>';
 try{
  if(pg==='store')await storePage(id,subpage==='category'?subId:'',subpage==='brand'?subId:'',subpage==='brand'?sourceProductId:'');
  else if(pg==='product')await productPage(id);
  else await landing();
 }
 catch(e){app.innerHTML=`<div class="wrap">حدث خطأ: ${esc(e.message)}</div>`}
}
async function landing(){
 homepageStores=await DB.list('stores',{},undefined,'id,name,description,icon,owner_name,whatsapp_phone');
 app.innerHTML=`<div class="hero"><div class="logo">✨ MKYM store ✨</div>
 <p>وجهتك لكل ما تحتاجه: تجميل، ألعاب، وأكثر. اختر متجرك وابدأ التسوق</p>
 <input class="search-field" type="search" placeholder="ابحث عن متجر..." aria-label="ابحث عن متجر" oninput="searchStores(this.value)" value="${esc(homepageQuery)}"></div>
 <div class="wrap"><div id="storeList" class="stores"></div></div>`;
 renderHomepageStores();
}
async function storePage(id,cat='',brandId='',sourceProductId=''){
 const [s,cats,all,brands]=await Promise.all([
  DB.get('stores',id,'id,name,description,icon,owner_name,whatsapp_phone'),
  DB.list('categories',{store_id:id},undefined,'id,store_id,parent_id,name,brand_id'),
  DB.list('products',{store_id:id},true,'id,store_id,category_id,name,description,price,sale_price,rating,images,out_of_stock,brand_id,sizes,colors,created_at'),
  DB.list('brands',{},undefined,'id,name')
 ]);
 if(!s)throw new Error('المتجر المطلوب غير موجود.');
 if(String(activeStoreId)!==String(id)){
  activeStoreId=id;activeProductQuery='';activeStoreFilterType='home';activeStoreCategoryId='';activeStoreBrandId='';
 }
 activeStoreCategories=cats;
 const categoryBrands=new Map(cats.map(category=>[String(category.id),category.brand_id]));
 const productBrandId=product=>product.brand_id??categoryBrands.get(String(product.category_id));
 activeStoreProductBrandId=productBrandId;
 const storeBrandIds=new Set(all.map(productBrandId).filter(id=>id!==null&&id!==undefined).map(String));
 activeStoreBrands=brands.filter(brand=>storeBrandIds.has(String(brand.id)));
 activeStoreAllProducts=all;
 activeStoreSourceProductId=sourceProductId||'';
 if(cat){activeStoreFilterType='category';activeStoreCategoryId=String(cat);activeStoreBrandId=''}
 else if(brandId){activeStoreFilterType='brand';activeStoreBrandId=String(brandId);activeStoreCategoryId=''}
 const categoryIds=activeStoreFilterType==='category'?[Number(activeStoreCategoryId),...categoryDescendants(cats,activeStoreCategoryId)]:null;
 activeStoreProducts=activeStoreFilterType==='brand'
  ?all.filter(product=>String(productBrandId(product))===String(activeStoreBrandId))
  :categoryIds?all.filter(product=>categoryIds.includes(Number(product.category_id))):all.slice();
 document.getElementById('storeFilterBtn').hidden=false;
 app.innerHTML=`<div class="hero" style="padding:36px 16px"><div class="logo" style="font-size:32px">${esc(s.icon)} ${esc(s.name)}</div>${s.owner_name?`<p class="store-owner-header">بإدارة ${esc(s.owner_name)}</p>`:''}<p>${esc(s.description)}</p><input class="search-field" type="search" placeholder="ابحث عن منتج في هذا المتجر..." aria-label="ابحث عن منتج في ${esc(s.name)}" oninput="searchProducts(this.value)" value="${esc(activeProductQuery)}"></div>
 <div class="wrap"><div id="storeBack"></div>
 <div id="storeProducts"></div></div>`;
 renderStoreBack();
 renderStoreFilters();
 renderStoreProducts();
}
let cur={imgs:[],i:0};
function show(i){cur.i=(i+cur.imgs.length)%cur.imgs.length;document.getElementById('mainImg').src=cur.imgs[cur.i];
 document.querySelectorAll('.thumbs img').forEach((t,k)=>t.classList.toggle('on',k===cur.i))}
function productColor(value,index){
 const raw=String(value??'').trim(),separator=raw.indexOf('|');
 const label=(separator<0?raw:raw.slice(0,separator)).trim()||`اللون ${index+1}`;
 const code=separator<0?raw:raw.slice(separator+1).trim();
 return {value:raw,label,color:/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(code)?code:'#777777'};
}
function getSelectedColors(){
 return Array.from(document.querySelectorAll('input[name="productColor"]:checked')).map(input=>input.value);
}
async function productPage(id){
 const p=await DB.get('products',id,'id,store_id,category_id,name,description,price,sale_price,rating,images,out_of_stock,brand_id,sizes,colors');
 if(!p)throw new Error('المنتج المطلوب غير موجود.');
 const [revs,sim,st,brands,category]=await Promise.all([
  DB.list('reviews',{product_id:id},true,'id,customer_name,rating,comment,screenshot_url'),
  DB.list('products',p.brand_id?{brand_id:p.brand_id}:{category_id:p.category_id},undefined,'id,store_id,category_id,name,description,price,sale_price,rating,images,out_of_stock,brand_id,sizes,colors'),
  DB.get('stores',p.store_id,'id,name,owner_name,whatsapp_phone'),
  DB.list('brands',{},undefined,'id,name'),
  DB.get('categories',p.category_id,'id,brand_id')
 ]);
 if(!st)throw new Error('متجر المنتج المطلوب غير موجود.');
 cur={imgs:p.images&&p.images.length?p.images:[''],i:0};
 const productBrandId=p.brand_id??category?.brand_id;
 const brand=brands.find(item=>String(item.id)===String(productBrandId));
 const sizes=p.sizes?.length?`<label class="variant-label" for="variant_sizes">المقاس (اختياري)</label><select class="variant-select" id="variant_sizes"><option value="">بدون تحديد مقاس</option>${p.sizes.map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('')}</select>`:'';
 const colors=p.colors?.length?`<span class="variant-label">اختر اللون${p.colors.length>1?' أو الألوان':''}</span><div class="product-colors">${p.colors.map((value,index)=>{
  const color=productColor(value,index);
  return `<label class="color-option"><input type="checkbox" name="productColor" value="${esc(color.value)}" ${index===0?'checked':''} aria-label="${esc(color.label)}"><span class="color-swatch" style="--swatch-color:${color.color}"></span><span>${esc(color.label)}</span></label>`;
 }).join('')}</div>`:'';
 app.innerHTML=`<div class="wrap"><button class="back-action" type="button" onclick="goBack('#/store/${p.store_id}')">→ ${esc(st.name)}</button>
 <div class="pd"><div class="car"><img id="mainImg" class="main" src="${esc(cur.imgs[0])}" loading="lazy" decoding="async" width="300" height="300">${p.out_of_stock?'<span class="stockout">انتهاء الكمية</span>':''}
 ${cur.imgs.length>1?`<button class="nv" style="right:8px" onclick="show(cur.i-1)">›</button><button class="nv" style="left:8px" onclick="show(cur.i+1)">‹</button>
 <div class="thumbs">${cur.imgs.map((u,k)=>`<img class="${k?'':'on'}" src="${esc(u)}" loading="lazy" decoding="async" width="300" height="300" onclick="show(${k})">`).join('')}</div>`:''}</div>
 <div><h1>${esc(p.name)}</h1>${brand?`<button class="product-brand-link" type="button" onclick="openProductBrand(${Number(p.store_id)},${Number(brand.id)},${Number(p.id)})">${esc(brand.name)}</button>`:''}<div class="st" style="margin:8px 0">${stars(p.rating)}</div>
 <div style="font-size:26px" class="pr"><span data-price="${eff(p)}">${money(eff(p))}</span>${p.sale_price?`<span class="old" data-price="${p.price}">${money(p.price)}</span>`:''}</div>
 ${colors}
 <p style="margin:14px 0;line-height:1.9">${esc(p.description)}</p>
 ${sizes}
 <div style="color:var(--m);font-size:13px">رقم المنتج: ${p.id}</div>
 <div class="row">${p.out_of_stock?(inquiry(p,st)?`<a class="btn2" href="${inquiry(p,st)}" target="_blank" rel="noopener noreferrer">استفسر عن توفر المنتج عبر واتساب</a>`:'<span class="btn2">لم يضف المتجر رقم واتساب بعد</span>'):`<button class="btn" onclick="addCart(${p.id},document.getElementById('variant_sizes')?.value||'',getSelectedColors())">🛒 إضافة إلى السلة</button>`}<button class="btn2" onclick="rate(${p.id})">⭐ التقييم</button></div></div></div>
 <h2>💬 آراء العملاء</h2>${revs.length?revs.map(r=>`<div class="rev"><b>${esc(r.customer_name)}</b> <span class="st">${stars(r.rating)}</span><p>${esc(r.comment)}</p>${r.screenshot_url?`<img src="${esc(r.screenshot_url)}" loading="lazy" decoding="async" width="300" height="300">`:''}</div>`).join(''):'<p>لا توجد آراء بعد.</p>'}
 ${sim.filter(x=>x.id!=p.id).length?`<h2>منتجات مشابهة${brand?` من ${esc(brand.name)}`:''}</h2><div class="grid">${sim.filter(x=>x.id!=p.id).slice(0,4).map(card).join('')}</div>`:''}</div>`;
}
async function rate(pid){
 const r=+prompt('قيّم المنتج من 1 إلى 5');if(!(r>=1&&r<=5))return;
 const n=prompt('اسمك:')||'زائر', c=prompt('تعليقك (اختياري):')||'';
 try{await DB.insert('reviews',{product_id:pid,customer_name:n,rating:r,comment:c,source:'site'});route()}catch(e){alert('تعذر الإرسال: '+e.message)}
}
/* ===== السلة ===== */
async function addCart(id,size='',colors=[]){
 await cartReady;
 const p=await DB.get('products',id,'id,store_id,category_id,name,description,price,sale_price,rating,images,out_of_stock,sizes,colors');if(!p)throw new Error('المنتج المطلوب غير موجود.');
 if(p.out_of_stock){alert('هذا المنتج غير متوفر حالياً.');return}
 if(p.colors?.length&&!colors.length){alert('يرجى اختيار لون واحد على الأقل قبل الإضافة إلى السلة.');return}
 const store=await DB.get('stores',p.store_id,'id,name,owner_name,whatsapp_phone');if(!store)throw new Error('متجر المنتج المطلوب غير موجود.');
 const selectedColors=p.colors?.length?colors:[''];
 selectedColors.forEach(value=>{
  const color=value?productColor(value,p.colors.indexOf(value)).label:'';
  const x=cart.find(c=>String(c.id)===String(id)&&c.size===(size||'')&&c.color===color);
  x?x.qty++:cart.push({id:p.id,store_id:store.id,store_name:store.name,owner_name:store.owner_name||'',whatsapp_phone:store.whatsapp_phone||'',name:p.name,price:eff(p),qty:1,img:(p.images||[])[0]||'',size:size||'',color});
 });
 saveCart();document.getElementById('drawer').classList.add('open');
}
function saveCart(){localStorage.setItem('mkym_cart',JSON.stringify(cart));drawCart()}
function qty(index,d){const x=cart[index];if(!x)return;x.qty+=d;if(x.qty<1)cart.splice(index,1);saveCart()}
function del(index){if(index<0||index>=cart.length)return;cart.splice(index,1);saveCart()}
function toggleCart(){document.getElementById('drawer').classList.toggle('open')}
function cartStoreMarkup(group){
 const items=group.items.map(c=>{const index=cart.indexOf(c);return `<div class="ci"><img src="${esc(c.img)}" loading="lazy" decoding="async" width="300" height="300"><div><b>${esc(c.name)}</b>${c.size?`<small>المقاس: ${esc(c.size)}</small>`:''}${c.color?`<small>اللون: ${esc(c.color)}</small>`:''}<div><span data-price="${c.price}">${money(c.price)}</span> × ${c.qty} = <span data-price="${c.price*c.qty}">${money(c.price*c.qty)}</span></div>
 <div class="q"><button onclick="qty(${index},-1)">−</button> ${c.qty} <button onclick="qty(${index},1)">+</button></div></div><button class="x" onclick="del(${index})">🗑️</button></div>`}).join('');
 const total=group.items.reduce((sum,c)=>sum+c.price*c.qty,0);
 const orderButton=storeWhatsApp({whatsapp_phone:group.phone})
  ?`<button class="wa" onclick="checkout(${Number(group.storeId)})">إتمام شراء منتجات هذا المتجر عبر واتساب</button>`
  :'<p class="cart-warning">أضف رقم واتساب لهذا المتجر من صفحة الإدارة لإتاحة الشراء.</p>';
 return `<section class="cart-store"><h4>${esc(group.name)}</h4><p class="cart-owner">${group.owner?`صاحب المتجر: ${esc(group.owner)}`:'لم يحدد صاحب المتجر'}</p>${items}<div class="cart-store-total">إجمالي المتجر: <span data-price="${total}">${money(total)}</span></div>${orderButton}</section>`;
}
function drawCart(){
 document.getElementById('cnt').textContent=cart.reduce((a,c)=>a+c.qty,0);
 const groups=cart.reduce((all,item)=>{
  const key=String(item.store_id);
  if(!all[key])all[key]={storeId:item.store_id,name:item.store_name||'متجر',owner:item.owner_name||'',phone:item.whatsapp_phone||'',items:[]};
  all[key].items.push(item);return all;
 },{});
 document.getElementById('drawer').innerHTML=`<div style="display:flex;justify-content:space-between"><h3>🛒 سلة التسوق</h3><button onclick="toggleCart()" style="background:none;font-size:22px">✕</button></div>
 ${cart.length?Object.values(groups).map(cartStoreMarkup).join(''):'<p style="margin-top:20px">السلة فارغة</p>'}`;
}
function checkout(storeId){
 const items=cart.filter(item=>String(item.store_id)===String(storeId));
 const group=items.length?{name:items[0].store_name,whatsapp_phone:items[0].whatsapp_phone}:null;
 if(!group||!storeWhatsApp(group)){alert('رقم واتساب هذا المتجر غير مضاف.');return}
 const lines=items.map((c,i)=>`${i+1}) ID: ${c.id} | ${c.name}${c.size?` | المقاس: ${c.size}`:''}${c.color?` | اللون: ${c.color}`:''} | العدد: ${c.qty} | السعر: ${money(c.price*c.qty)}`).join('\n');
 const total=items.reduce((sum,c)=>sum+c.qty*c.price,0);
 const msg=`مرحباً ${items[0].owner_name||''}، أرغب بطلب المنتجات من ${group.name}:\n${lines}\n\nالإجمالي: ${money(total)}`;
 window.open(storeWhatsApp(group,msg),'_blank','noopener,noreferrer');
}
window.addEventListener('hashchange',route);
cartReady.then(drawCart).catch(error=>{document.getElementById('drawer').innerHTML=`<p class="cart-warning">تعذر تحميل بيانات السلة: ${esc(error.message)}</p>`});
loadExchangeRate().catch(error=>console.error('تعذر تحميل سعر الصرف.',error));
route();
