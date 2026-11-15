const app=document.getElementById('app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
const currencyName=()=>currency==='SAR'?'ر.س':'ر.ي';
const money=n=>{
 const amount=currency==='SAR'&&sarToYerRate>0?Number(n)/sarToYerRate:Number(n);
 return amount.toLocaleString('ar-EG',currency==='SAR'?{minimumFractionDigits:2,maximumFractionDigits:2}:undefined)+' '+currencyName();
};
async function loadExchangeRate(){
 const setting=await DB.get('exchange_rates','sar');
 sarToYerRate=Number(setting?.sar_to_yer)||null;
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
document.addEventListener('keydown',event=>{
 if(event.key==='Escape')toggleSettingsPanel(false);
});
const eff=p=>p.sale_price||p.price;
const phoneDigits=phone=>String(phone||'').replace(/\D/g,'');
const storeWhatsApp=(store,text='')=>{
 const phone=phoneDigits(store?.whatsapp_phone);
 return phone.length>=8&&phone.length<=15?`https://wa.me/${phone}${text?`?text=${encodeURIComponent(text)}`:''}`:'';
};
const inquiry=(p,store)=>storeWhatsApp(store,`مرحباً، أستفسر عن توفر المنتج: ${p.name} (رقم ${p.id})`);
const stars=r=>{r=Math.round(r||0);return '★'.repeat(r)+'☆'.repeat(5-r)};
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
function showStoreContact(store){
 const box=document.getElementById('storeContact');
 if(!store){box.hidden=true;box.innerHTML='';return}
 const href=storeWhatsApp(store,`مرحباً، أتواصل مع صاحب ${store.name}.`);
 box.hidden=false;
 box.innerHTML=`${href?`<a class="store-wa" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="تواصل عبر واتساب مع ${esc(store.owner_name||store.name)}" title="واتساب صاحب المتجر"><img src="Whatsapp.ico" alt=""></a>`:'<span class="store-wa unavailable" title="رقم واتساب غير مضاف" aria-hidden="true"><img src="Whatsapp.ico" alt=""></span>'}<span class="store-owner">${esc(store.owner_name||'لم يحدد المالك')}</span>`;
}

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
let activeStoreCategories=[];
const categoryDescendants=(categories,id)=>categories.filter(category=>String(category.parent_id)===String(id))
 .flatMap(category=>[category.id,...categoryDescendants(categories,category.id)]);
function categoryButtons(categories,parentId=null,depth=0,selectedId=''){
 return categories.filter(category=>parentId===null?!category.parent_id:String(category.parent_id)===String(parentId))
  .map(category=>`<button class="chip ${String(selectedId)===String(category.id)?'on':''}" style="margin-inline-start:${depth*14}px" onclick="storePage('${activeStoreId}',${category.id})">${esc(category.name)}</button>${categoryButtons(categories,category.id,depth+1,selectedId)}`).join('');
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
 const offers=activeStoreProducts.filter(product=>product.sale_price).slice(0,5),fresh=activeStoreProducts.slice(0,5);
 const sec=(title,products,strip=false)=>products.length?`<h2>${title}</h2><div class="${strip?'product-strip':'grid'}">${products.map(card).join('')}</div>`:'';
 container.innerHTML=`${sec('🔥 العروض والمجموعات المخفضة',offers,true)}${sec('🆕 أضيف حديثاً',fresh,true)}${sec('جميع المنتجات',activeStoreProducts)}${activeStoreProducts.length?'':'<p class="search-empty">لا توجد منتجات بعد.</p>'}`;
}
function searchProducts(value){activeProductQuery=value;renderStoreProducts()}
async function route(){
 window.scrollTo(0,0);
 showStoreContact(null);
 const [,pg,id]=location.hash.split('/');
 app.innerHTML='<div class="wrap">جارٍ التحميل...</div>';
 try{await loadExchangeRate();if(pg==='store')await storePage(id); else if(pg==='product')await productPage(id); else await landing();}
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
async function storePage(id,cat){
 const [s,cats,all]=await Promise.all([
  DB.get('stores',id,'id,name,description,icon,owner_name,whatsapp_phone'),
  DB.list('categories',{store_id:id},undefined,'id,store_id,parent_id,name,brand_id'),
  DB.list('products',{store_id:id},true,'id,store_id,category_id,name,description,price,sale_price,rating,images,out_of_stock,brand_id,sizes,colors')
 ]);
 if(!s)throw new Error('المتجر المطلوب غير موجود.');
 if(String(activeStoreId)!==String(id)){activeStoreId=id;activeProductQuery=''}
 showStoreContact(s);
 activeStoreCategories=cats;
 const categoryIds=cat?[Number(cat),...categoryDescendants(cats,cat)]:null;
 activeStoreProducts=categoryIds?all.filter(p=>categoryIds.includes(Number(p.category_id))):all;
 app.innerHTML=`<div class="hero" style="padding:36px 16px"><div class="logo" style="font-size:32px">${esc(s.icon)} ${esc(s.name)}</div>${s.owner_name?`<p class="store-owner-header">بإدارة ${esc(s.owner_name)}</p>`:''}<p>${esc(s.description)}</p><input class="search-field" type="search" placeholder="ابحث عن منتج في هذا المتجر..." aria-label="ابحث عن منتج في ${esc(s.name)}" oninput="searchProducts(this.value)" value="${esc(activeProductQuery)}"></div>
 <div class="wrap"><a class="back" href="#/">→ الرئيسية</a>
 <div class="chips"><button class="chip ${!cat?'on':''}" onclick="storePage(${id},'')">الكل</button>
 ${categoryButtons(cats,null,0,cat||'')}</div>
 <div id="storeProducts"></div></div>`;
 renderStoreProducts();
}
let cur={imgs:[],i:0};
function show(i){cur.i=(i+cur.imgs.length)%cur.imgs.length;document.getElementById('mainImg').src=cur.imgs[cur.i];
 document.querySelectorAll('.thumbs img').forEach((t,k)=>t.classList.toggle('on',k===cur.i))}
async function productPage(id){
 const p=await DB.get('products',id,'id,store_id,category_id,name,description,price,sale_price,rating,images,out_of_stock,brand_id,sizes,colors');
 if(!p)throw new Error('المنتج المطلوب غير موجود.');
 const [revs,sim,st,brands]=await Promise.all([
  DB.list('reviews',{product_id:id},true,'id,customer_name,rating,comment,screenshot_url'),
  DB.list('products',p.brand_id?{brand_id:p.brand_id}:{category_id:p.category_id},undefined,'id,store_id,category_id,name,description,price,sale_price,rating,images,out_of_stock,brand_id,sizes,colors'),
  DB.get('stores',p.store_id,'id,name,owner_name,whatsapp_phone'),
  DB.list('brands',{},undefined,'id,name')
 ]);
 if(!st)throw new Error('متجر المنتج المطلوب غير موجود.');
 showStoreContact(st);
 cur={imgs:p.images&&p.images.length?p.images:[''],i:0};
 const brand=brands.find(item=>String(item.id)===String(p.brand_id));
 const variants=(key,label)=>p[key]?.length?`<label class="variant-label" for="variant_${key}">${label}</label><select class="variant-select" id="variant_${key}"><option value="">اختر ${label}</option>${p[key].map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('')}</select>`:'';
 app.innerHTML=`<div class="wrap"><a class="back" href="#/store/${p.store_id}">→ ${esc(st.name)}</a>
 <div class="pd"><div class="car"><img id="mainImg" class="main" src="${esc(cur.imgs[0])}" loading="lazy" decoding="async" width="300" height="300">${p.out_of_stock?'<span class="stockout">انتهاء الكمية</span>':''}
 ${cur.imgs.length>1?`<button class="nv" style="right:8px" onclick="show(cur.i-1)">›</button><button class="nv" style="left:8px" onclick="show(cur.i+1)">‹</button>
 <div class="thumbs">${cur.imgs.map((u,k)=>`<img class="${k?'':'on'}" src="${esc(u)}" loading="lazy" decoding="async" width="300" height="300" onclick="show(${k})">`).join('')}</div>`:''}</div>
 <div><h1>${esc(p.name)}</h1><div class="st" style="margin:8px 0">${stars(p.rating)}</div>
 ${brand?`<p class="product-brand">العلامة التجارية: ${esc(brand.name)}</p>`:''}
 <div style="font-size:26px" class="pr"><span data-price="${eff(p)}">${money(eff(p))}</span>${p.sale_price?`<span class="old" data-price="${p.price}">${money(p.price)}</span>`:''}</div>
 <p style="margin:14px 0;line-height:1.9">${esc(p.description)}</p>
 ${variants('sizes','المقاس')}${variants('colors','اللون')}
 <div style="color:var(--m);font-size:13px">رقم المنتج: ${p.id}</div>
 <div class="row">${p.out_of_stock?(inquiry(p,st)?`<a class="btn2" href="${inquiry(p,st)}" target="_blank" rel="noopener noreferrer">استفسر عن توفر المنتج عبر واتساب</a>`:'<span class="btn2">لم يضف المتجر رقم واتساب بعد</span>'):`<button class="btn" onclick="addCart(${p.id},document.getElementById('variant_sizes')?.value||'',document.getElementById('variant_colors')?.value||'')">🛒 إضافة إلى السلة</button>`}<button class="btn2" onclick="rate(${p.id})">⭐ التقييم</button></div></div></div>
 <h2>💬 آراء العملاء</h2>${revs.length?revs.map(r=>`<div class="rev"><b>${esc(r.customer_name)}</b> <span class="st">${stars(r.rating)}</span><p>${esc(r.comment)}</p>${r.screenshot_url?`<img src="${esc(r.screenshot_url)}" loading="lazy" decoding="async" width="300" height="300">`:''}</div>`).join(''):'<p>لا توجد آراء بعد.</p>'}
 ${sim.filter(x=>x.id!=p.id).length?`<h2>منتجات مشابهة${brand?` من ${esc(brand.name)}`:''}</h2><div class="grid">${sim.filter(x=>x.id!=p.id).slice(0,4).map(card).join('')}</div>`:''}</div>`;
}
async function rate(pid){
 const r=+prompt('قيّم المنتج من 1 إلى 5');if(!(r>=1&&r<=5))return;
 const n=prompt('اسمك:')||'زائر', c=prompt('تعليقك (اختياري):')||'';
 try{await DB.insert('reviews',{product_id:pid,customer_name:n,rating:r,comment:c,source:'site'});route()}catch(e){alert('تعذر الإرسال: '+e.message)}
}
/* ===== السلة ===== */
async function addCart(id,size='',color=''){
 await cartReady;
 const p=await DB.get('products',id,'id,store_id,category_id,name,description,price,sale_price,rating,images,out_of_stock,sizes,colors');if(!p)throw new Error('المنتج المطلوب غير موجود.');
 if(p.out_of_stock){alert('هذا المنتج غير متوفر حالياً.');return}
 if((p.sizes?.length&&!size)||(p.colors?.length&&!color)){alert('يرجى اختيار المقاس واللون قبل الإضافة إلى السلة.');return}
 const store=await DB.get('stores',p.store_id,'id,name,owner_name,whatsapp_phone');if(!store)throw new Error('متجر المنتج المطلوب غير موجود.');
 const x=cart.find(c=>String(c.id)===String(id)&&c.size===(size||'')&&c.color===(color||''));
 x?x.qty++:cart.push({id:p.id,store_id:store.id,store_name:store.name,owner_name:store.owner_name||'',whatsapp_phone:store.whatsapp_phone||'',name:p.name,price:eff(p),qty:1,img:(p.images||[])[0]||'',size:size||'',color:color||''});
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
route();
