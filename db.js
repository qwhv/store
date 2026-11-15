// ===== الإعدادات =====
const SUPABASE_URL = 'https://vuqjkoieepmikkrcndhj.supabase.co';   // https://xxxx.supabase.co
const SUPABASE_KEY = 'sb_publishable_59pBHWAkmssTMB8ijc6Mcg_D-d6bHKB';   // anon public key
const WA = '967776676326';

const sb = (SUPABASE_URL && window.supabase) ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
const cache = {};
const CACHE_TTL = 5 * 60 * 1000;
const pic = n => `https://picsum.photos/seed/${n}/300/300`;
const seed = {
  stores: [
    {id:1,name:'متجر التجميل والأكسسوارات',description:'عناية وجمال وإكسسوارات أنيقة',icon:'💄',owner_name:'',whatsapp_phone:''},
    {id:2,name:'متجر الألعاب وببجي',description:'شحن شدات وألعاب وملحقات',icon:'🎮',owner_name:'',whatsapp_phone:''}],
  categories: [
    {id:1,store_id:1,name:'العناية بالشعر',parent_id:null,brand_id:null},{id:2,store_id:1,name:'الأكسسوارات',parent_id:null,brand_id:null},
    {id:3,store_id:2,name:'شحن ببجي',parent_id:null,brand_id:null},{id:4,store_id:2,name:'ملحقات الألعاب',parent_id:null,brand_id:null}],
  products: [
    {id:1,store_id:1,category_id:1,name:'زيت الأرغان للشعر',description:'زيت طبيعي لتغذية الشعر وتقويته.',price:6000,sale_price:4500,rating:4.5,images:[pic('a1'),pic('a2')],sizes:[],colors:[],brand_id:null,merchant_id:null,purchase_price:null,out_of_stock:false,created_at:'2026-11-01'},
    {id:2,store_id:1,category_id:1,name:'شامبو بالكيراتين',description:'شامبو لشعر ناعم ولامع.',price:5000,sale_price:null,rating:4,images:[pic('b1')],sizes:[],colors:[],brand_id:null,merchant_id:null,purchase_price:null,created_at:'2026-11-02'},
    {id:3,store_id:1,category_id:2,name:'سوار فضي',description:'سوار أنيق بتصميم عصري.',price:3000,sale_price:2500,rating:5,images:[pic('c1')],sizes:[],colors:[],brand_id:null,merchant_id:null,purchase_price:null,created_at:'2026-11-03'},
    {id:4,store_id:2,category_id:3,name:'660 شدة ببجي',description:'شحن فوري عبر ID اللاعب.',price:9000,sale_price:8500,rating:5,images:[pic('d1')],sizes:[],colors:[],brand_id:null,merchant_id:null,purchase_price:null,created_at:'2026-11-04'},
    {id:5,store_id:2,category_id:4,name:'يد تحكم للجوال',description:'يد تحكم متوافقة مع معظم الجوالات.',price:12000,sale_price:null,rating:4.5,images:[pic('e1')],sizes:[],colors:[],brand_id:null,merchant_id:null,purchase_price:null,created_at:'2026-11-05'}],
  merchants: [],
  brands: [],
  reviews: [{id:1,product_id:1,customer_name:'أم سارة',rating:5,comment:'منتج ممتاز ووصل بسرعة',source:'whatsapp'}],
  exchange_rates: []
};
const loc = () => {
  let d = localStorage.getItem('mkym_db');
  if (!d) { d = JSON.stringify(seed); localStorage.setItem('mkym_db', d); }
  const data = JSON.parse(d);
  if (!data.exchange_rates) data.exchange_rates = [];
  if (!data.merchants) data.merchants = [];
  if (!data.brands) data.brands = [];
  data.categories.forEach(category => {
    if (category.parent_id === undefined) category.parent_id = null;
    if (category.brand_id === undefined) category.brand_id = null;
  });
  data.products.forEach(product => {
    if (product.sizes === undefined) product.sizes = [];
    if (product.colors === undefined) product.colors = [];
    if (product.brand_id === undefined) product.brand_id = null;
    if (product.merchant_id === undefined) product.merchant_id = null;
    if (product.purchase_price === undefined) product.purchase_price = null;
  });
  return data;
};

const DB = {
  demo: !sb,
  async list(t, f = {}, newest, columns = '*') {
    if (sb) {
      const unfiltered = Object.keys(f).length === 0;
      const cacheable = unfiltered;
      const cached = cacheable ? cache[t] : null;
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        return newest
          ? cached.data.slice().sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)))
          : cached.data;
      }
      let q = sb.from(t).select(columns); for (const k in f) q = q.eq(k, f[k]);
      if (newest && !unfiltered) q = q.order('created_at', {ascending:false});
      const {data, error} = await q; if (error) throw error;
      if (cacheable) cache[t] = {data, ts:Date.now()};
      return newest
        ? data.slice().sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)))
        : data;
    }
    let r = loc()[t].filter(x => Object.keys(f).every(k => x[k] == f[k]));
    return newest ? r.sort((a,b) => String(b.created_at).localeCompare(String(a.created_at))) : r;
  },
  async get(t, id, columns = '*') {
    if (sb) {
      const {data, error} = await sb.from(t).select(columns).eq('id', id).limit(1);
      if (error) throw error;
      return data[0];
    }
    return (await this.list(t, {id}))[0];
  },
  async insert(t, row) {
    if (sb) {
      const {data, error} = await sb.from(t).insert(row).select().single();
      if (error) throw error;
      delete cache[t];
      return data;
    }
    const d = loc(); row.id = row.id ?? Date.now(); row.created_at = new Date().toISOString();
    d[t].push(row); localStorage.setItem('mkym_db', JSON.stringify(d)); delete cache[t]; return row;
  },
  async update(t, id, row) {
    if (sb) {
      const {data, error} = await sb.from(t).update(row).eq('id', id).select().single();
      if (error) throw error;
      delete cache[t];
      return data;
    }
    const d = loc(), i = d[t].findIndex(x => x.id == id);
    if (i < 0) throw new Error('العنصر المطلوب غير موجود.');
    d[t][i] = {...d[t][i], ...row}; localStorage.setItem('mkym_db', JSON.stringify(d)); delete cache[t]; return d[t][i];
  },
  async delete(t, id) {
    if (sb) {
      const {error} = await sb.from(t).delete().eq('id', id);
      if (error) throw error;
      delete cache[t];
      return;
    }
    const d = loc(), row = d[t].find(x => x.id == id);
    if (!row) throw new Error('العنصر المطلوب غير موجود.');
    if (t === 'stores' && d.products.some(p => p.store_id == id)) throw new Error('لا يمكن حذف متجر يحتوي على منتجات. انقل المنتجات أو احذفها أولاً.');
    if (t === 'categories' && d.products.some(p => p.category_id == id)) throw new Error('لا يمكن حذف نوع يحتوي على منتجات. انقل المنتجات أو احذفها أولاً.');
    if (t === 'categories' && d.categories.some(c => c.parent_id == id)) throw new Error('لا يمكن حذف قسم يحتوي على أقسام فرعية. انقل الأقسام الفرعية أولاً.');
    if (t === 'merchants' && d.products.some(p => p.merchant_id == id)) throw new Error('لا يمكن حذف تاجر مرتبط بمنتجات.');
    if (t === 'brands') {
      d.categories.forEach(category => { if (category.brand_id == id) category.brand_id = null; });
      d.products.forEach(product => { if (product.brand_id == id) product.brand_id = null; });
    }
    if (t === 'categories') d.categories.forEach(category => {
      if (category.parent_id == id) category.parent_id = null;
    });
    d[t] = d[t].filter(x => x.id != id);
    if (t === 'stores') d.categories = d.categories.filter(x => x.store_id != id);
    if (t === 'products') d.reviews = d.reviews.filter(x => x.product_id != id);
    localStorage.setItem('mkym_db', JSON.stringify(d)); delete cache[t];
  }
};
