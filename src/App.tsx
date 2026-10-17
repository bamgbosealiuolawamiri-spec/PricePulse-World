import {useEffect,useMemo,useRef,useState} from 'react'
import type {FormEvent} from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import AuthPage from './Auth'
import {AREAS,CATS,CUR,SHOPS,PRODUCTS,offersFor,history,change,km,Loc,Product,Shop} from './data'
import {dbRequest, type SessionAccount} from './db'

function useLS<T>(k:string,init:T):[T,(v:T)=>void]{
  const [v,s]=useState<T>(()=>{try{const x=localStorage.getItem('pp:'+k);return x?JSON.parse(x):init}catch{return init}})
  return [v,(n:T)=>{s(n);try{localStorage.setItem('pp:'+k,JSON.stringify(n))}catch{/* storage unavailable */}}]
}
const money=(n:number,c='NGN')=>{try{return new Intl.NumberFormat(undefined,{style:'currency',currency:c,maximumFractionDigits:2}).format(n)}catch{return `${c} ${n.toLocaleString()}`}}
const Demo=()=><span className="chip" title="Sample data, not real prices">Demo data</span>
const go=(p:string)=>{location.hash=p}
const best=(p:Product)=>offersFor(p).reduce((a,b)=>a.price<b.price?a:b)

const mapShop=(r:any)=>({id:r.id,name:r.name,area:[r.address,r.city,r.country].filter(Boolean).join(', '),lat:Number(r.latitude),lng:Number(r.longitude),verified:r.verification_status==='verified',country:r.country,city:r.city,address:r.address,status:r.verification_status,owner_id:r.owner_id})
const mapPrice=(r:any)=>({id:r.id,product:r.product_name,shop:r.shop_name,area:r.location,price:Number(r.price),date:r.date_seen,saved:r.created_at,status:r.verification_status==='approved'?'Approved':r.verification_status==='rejected'?'Rejected':'Pending verification',currency:r.currency_code||'USD',country:r.country,submitted_by:r.submitted_by})
async function fetchSharedData(account:SessionAccount|null){
  const [shopRows,priceRows]=await Promise.all([
    dbRequest<any[]>('shops',{account,query:'select=*&order=created_at.desc&limit=500'}),
    dbRequest<any[]>('price_reports',{account,query:'select=*&order=created_at.desc&limit=500'})
  ])
  return {shops:(shopRows||[]).map(mapShop),subs:(priceRows||[]).map(mapPrice)}
}

function MapView({center,loc,shops}:{center:Loc;loc:Loc;shops:(Shop&{verified?:boolean})[]}){
  const el=useRef<HTMLDivElement>(null)
  useEffect(()=>{
    if(!el.current)return
    const m=L.map(el.current).setView([center.lat,center.lng],12)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}).addTo(m)
    L.circleMarker([loc.lat,loc.lng],{radius:9,color:'#C94B29',fillColor:'#F0643B',fillOpacity:1}).addTo(m).bindPopup('Your selected location')
    shops.forEach(s=>L.circleMarker([s.lat,s.lng],{radius:7,color:'#27231F',fillColor:'#fff',fillOpacity:1}).addTo(m).bindPopup(`${s.name}<br/>${s.area}<br/>${km(loc,s).toFixed(1)} km · ${s.verified?'Verified':'Not verified'}`))
    return()=>{m.remove()}
  },[center,loc,shops])
  return <div ref={el} className="h-72 w-full rounded-2xl border" role="region" aria-label="Map of added shops"/>
}

export default function App(){
  const [hash,setHash]=useState(location.hash||'#/')
  useEffect(()=>{const f=()=>{setHash(location.hash||'#/');window.scrollTo(0,0)};addEventListener('hashchange',f);return()=>removeEventListener('hashchange',f)},[])
  const [loc,setLoc]=useLS<Loc>('loc',AREAS[0])
  const [saved,setSaved]=useLS<string[]>('saved',[])
  const [alerts,setAlerts]=useLS<Record<string,number>>('alerts',{})
  const [basket,setBasket]=useLS<Record<string,number>>('basket',{})
  const [subs,setSubs]=useState<any[]>([])
  const [shops,setShops]=useState<any[]>([])
  const [country,setCountry]=useLS('country','Nigeria')
  const [city,setCity]=useLS('city','Lagos')
  const [currency,setCurrency]=useLS('currency','NGN')
  const [dataError,setDataError]=useState('')
  const refreshSharedData=async()=>{try{const data=await fetchSharedData(account);setShops(data.shops);setSubs(data.subs);setDataError('')}catch(e){setDataError(e instanceof Error?e.message:'Could not load shared data.')}}
  useEffect(()=>{let active=true;fetchSharedData(account).then(data=>{if(active){setShops(data.shops);setSubs(data.subs);setDataError('')}}).catch(e=>{if(active)setDataError(e instanceof Error?e.message:'Could not load shared data.')});return()=>{active=false}},[account?.id,account?.access_token])
  const [account,setAccount]=useLS<{id:string;email:string;name:string;access_token?:string;refresh_token?:string}|null>('account',null)
  const [geoMsg,setGeoMsg]=useState('')
  const [q,setQ]=useState('')
  const [menu,setMenu]=useState(false)

  const locate=()=>{
    if(!navigator.geolocation){setGeoMsg('Location is not supported by this browser. Please choose an area manually.');return}
    setGeoMsg('Requesting location…')
    navigator.geolocation.getCurrentPosition(p=>{setLoc({name:'My current location',lat:p.coords.latitude,lng:p.coords.longitude});setGeoMsg('')},
      e=>setGeoMsg(e.code===1?'Location permission denied. Choose an area manually below, or allow location in your browser settings.':'Could not get your location. Choose an area manually.'),{timeout:10000})
  }
  const [route,arg]=hash.replace('#/','').split('?')[0].split('/')
  const toggleSave=(id:string)=>setSaved(saved.includes(id)?saved.filter(x=>x!==id):[...saved,id])
  const dist=(s:{lat:number;lng:number})=>km(loc,s)
  const ctx={loc,saved,toggleSave,alerts,setAlerts,basket,setBasket,subs,setSubs,shops,setShops,dist,account,country,setCountry,city,setCity,currency,setCurrency,refreshSharedData}

  const links=[['','Home'],['search','Search'],['shops','Shops'],['basket','Basket'],['saved','Saved'],['submit','Submit price'],['admin','Admin'],['auth',account?'Account':'Log in']]
  return <div className="min-h-screen flex flex-col">
    <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-2">Skip to content</a>
    <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <a href="#/" className="flex items-center gap-2 font-extrabold text-deep"><span className="grid h-8 w-8 place-items-center rounded-xl bg-brand text-white">₦</span>PricePulse <span className="text-brand">World</span></a>
        <nav className="hidden gap-1 md:flex" aria-label="Main">{links.map(([h,l])=><a key={h} href={'#/'+h} className={`rounded-lg px-3 py-2 text-sm font-medium hover:bg-soft ${route===h?'bg-soft text-deep':'text-mute'}`}>{l}{h==='basket'&&Object.keys(basket).length?` (${Object.keys(basket).length})`:''}</a>)}</nav>
        <button className="btn2 md:hidden" aria-expanded={menu} aria-label="Toggle menu" onClick={()=>setMenu(!menu)}>{menu?'✕':'☰'}</button>
      </div>
      {menu&&<nav className="grid gap-1 border-t p-3 md:hidden" aria-label="Mobile">{links.map(([h,l])=><a key={h} href={'#/'+h} onClick={()=>setMenu(false)} className="rounded-lg px-3 py-3 font-medium hover:bg-soft">{l}</a>)}</nav>}
    </header>
    <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm"><span className="text-mute">🌍 Market</span>
        <label className="text-xs text-mute">Country<input aria-label="Market country" className="ml-1 rounded-lg border px-2 py-1 text-sm text-slate-900" value={country} onChange={e=>setCountry(e.target.value)} placeholder="Country" /></label>
        <label className="text-xs text-mute">City<input aria-label="Market city" className="ml-1 rounded-lg border px-2 py-1 text-sm text-slate-900" value={city} onChange={e=>setCity(e.target.value)} placeholder="City" /></label>
        <label className="text-xs text-mute">Currency<select aria-label="Display currency" className="ml-1 rounded-lg border px-2 py-1 text-sm text-slate-900" value={currency} onChange={e=>setCurrency(e.target.value)}>{['NGN','GHS','KES','ZAR','GBP','USD','CAD','EUR','INR','AUD'].map(code=><option key={code} value={code}>{code}</option>)}</select></label>
        <button className="btn2 !py-1" onClick={locate}>Use my location</button></div>
      {geoMsg&&<p role="status" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{geoMsg}</p>}
      {dataError&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">Shared data could not load: {dataError}</p>}
      {route===''&&<Home q={q} setQ={setQ} {...ctx}/>}
      {route==='auth'&&<AuthPage mode={hash.includes('mode=signup')?'signup':'login'} account={account} setAccount={setAccount}/>}
      {route==='search'&&<Search {...ctx} q={new URLSearchParams(hash.includes('?')?hash.slice(hash.indexOf('?')+1):'').get('q')||''} cat={new URLSearchParams(hash.includes('?')?hash.slice(hash.indexOf('?')+1):'').get('cat')||''}/>}
      {route==='p'&&<Detail id={arg} {...ctx}/>}
      {route==='shops'&&<Shops {...ctx}/>}
      {route==='basket'&&<Basket {...ctx}/>}
      {route==='saved'&&<Saved {...ctx}/>}
      {route==='submit'&&<Submit {...ctx}/>}
      {route==='admin'&&<Admin {...ctx}/>}
      {!['','search','p','shops','basket','saved','submit','admin','auth'].includes(route)&&<Empty t="Page not found" d="That page doesn't exist."/>}
    </main>
    <footer className="border-t bg-soft px-4 py-6 text-center text-xs text-mute">PricePulse World · Know the price. Compare the world. Save smarter.<br/>Only submitted listings are shown. Shop and price submissions require verification before being treated as trusted. Maps © OpenStreetMap contributors.</footer>
  </div>
}

type C=any
const Empty=({t,d}:{t:string;d:string})=><div className="card py-10 text-center"><p className="text-3xl">🔍</p><h2 className="mt-2 font-bold">{t}</h2><p className="text-sm text-mute">{d}</p></div>

function Card({p,c}:{p:Product;c:C}){
  const offers=offersFor(p),b=offers[0],ch=change(p).pct
  if(!b)return <Empty t="No verified price yet" d="No shop has submitted a price for this product yet."/>
  return <div className="card flex flex-col gap-2">
    <div className="flex justify-between"><span className="chip">{p.cat}</span><button aria-pressed={c.saved.includes(p.id)} aria-label={`Save ${p.name}`} onClick={()=>c.toggleSave(p.id)}>{c.saved.includes(p.id)?'★':'☆'}</button></div>
    <a href={'#/p/'+p.id} className="font-semibold hover:text-deep">{p.name}</a>
    <p className="text-lg font-extrabold text-deep">{money(b.price)} <span className={`text-xs ${ch<=0?'text-brand':'text-red-600'}`}>{ch>0?'▲':'▼'} {Math.abs(ch).toFixed(1)}%</span></p>
    <p className="text-xs text-mute">Lowest submitted offer · {b.shop.name} · {c.dist(b.shop).toFixed(1)} km</p>
  </div>
}

function Home({q,setQ,...c}:C){
  const approvedPrices=c.subs.filter((s:any)=>s.status==='Approved')
  const verifiedShops=c.shops.filter((s:Shop&{verified?:boolean})=>s.verified)
  const pendingPrices=c.subs.filter((s:any)=>s.status!=='Approved').length
  return <div className="space-y-10">
    <section className="relative isolate overflow-hidden rounded-[2rem] bg-[#101B35] px-6 py-10 text-white shadow-xl md:px-10 md:py-14">
      <div aria-hidden="true" className="absolute -right-12 -top-16 -z-10 h-72 w-72 rounded-full bg-orange-400/30 blur-3xl"/>
      <div aria-hidden="true" className="absolute -bottom-24 left-1/3 -z-10 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl"/>
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-orange-50"><span className="h-2 w-2 rounded-full bg-cyan-300"/> LOCAL PRICES. SMARTER CHOICES.</div>
      <div className="grid items-center gap-8 md:grid-cols-[1.2fr_.8fr]">
        <div>
          <h1 className="max-w-2xl text-4xl font-black leading-[1.08] tracking-tight md:text-6xl">Know the price.<br/><span className="text-cyan-300">Keep more money.</span></h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-200 md:text-lg">Compare community-reported prices, discover nearby shops, and make a more confident choice before you buy.</p>
          <form className="mt-7 flex flex-col gap-2 rounded-2xl bg-white p-2 shadow-lg sm:flex-row" role="search" onSubmit={e=>{e.preventDefault();go('/search?q='+encodeURIComponent(q))}}>
            <span className="hidden items-center pl-3 text-xl text-slate-400 sm:flex" aria-hidden="true">⌕</span>
            <input aria-label="Search products" className="min-w-0 flex-1 border-0 px-3 py-3 text-sm text-[#27231F] outline-none ring-0 placeholder:text-slate-400 focus:ring-0" placeholder="What do you want to price-check?" value={q} onChange={e=>setQ(e.target.value)}/>
            <button className="rounded-xl bg-orange-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-orange-700">Find prices <span aria-hidden="true">→</span></button>
          </form>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-300"><span>✓ Community submitted</span><span>✓ Verification first</span><span>✓ Starting in Lagos</span></div>
        </div>
        <div className="mx-auto w-full max-w-sm">
          <div className="rounded-3xl border border-white/15 bg-white/[0.08] p-5 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-100">PricePulse snapshot</span><span className="rounded-full bg-cyan-300/15 px-2.5 py-1 text-[11px] font-bold text-cyan-200">LIVE COMMUNITY</span></div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/10 p-4"><p className="text-3xl font-black">{approvedPrices.length}</p><p className="mt-1 text-xs text-slate-300">Approved prices</p></div>
              <div className="rounded-2xl bg-white/10 p-4"><p className="text-3xl font-black">{verifiedShops.length}</p><p className="mt-1 text-xs text-slate-300">Verified shops</p></div>
            </div>
            <div className="mt-4 rounded-2xl bg-[#0B1225]/70 p-4"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300 text-xl text-[#101B35]">⌖</div><div><p className="text-sm font-bold">Your area</p><p className="text-xs text-slate-300">{c.loc.name}</p></div><span className="ml-auto text-cyan-300">●</span></div><p className="mt-3 text-xs leading-5 text-slate-300">Choose your area or use your location to explore nearby verified listings.</p></div>
          </div>
        </div>
      </div>
    </section>

    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-orange-700">Explore</p><h2 className="mt-1 text-2xl font-extrabold tracking-tight text-[#27231F]">What are you shopping for?</h2><p className="mt-1 text-sm text-slate-500">Start with a category or search for a specific item.</p></div><a href="#/search" className="text-sm font-bold text-orange-700 hover:underline">Browse all →</a></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {CATS.map((k,i)=><a key={k} className="group flex min-h-24 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md" href={'#/search?q=&cat='+encodeURIComponent(k)}><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange-50 text-xl text-orange-700 transition group-hover:bg-orange-100">{['🛒','📱','🏠','🔌','🥫','🧴','👕','🧰'][i%8]}</span><span className="text-sm font-bold text-slate-800">{k}</span><span className="ml-auto text-slate-400 transition group-hover:translate-x-1 group-hover:text-orange-700">→</span></a>)}
      </div>
    </section>

    <section className="grid gap-4 md:grid-cols-2">
      <a href="#/submit" className="group rounded-3xl border border-orange-100 bg-gradient-to-br from-blue-50 to-white p-6 transition hover:border-orange-300 hover:shadow-md"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-600 text-2xl text-white">＋</span><h2 className="mt-4 text-xl font-extrabold text-slate-900">Share a price</h2><p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">Seen a price in a shop? Submit it to help other shoppers make informed decisions. Submissions are marked pending until reviewed.</p><span className="mt-4 inline-flex font-bold text-orange-700">Submit a price <span className="ml-2 transition group-hover:translate-x-1">→</span></span></a>
      <a href="#/shops" className="group rounded-3xl border border-slate-200 bg-white p-6 transition hover:border-orange-300 hover:shadow-md"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-2xl text-white">⌖</span><h2 className="mt-4 text-xl font-extrabold text-slate-900">Find local shops</h2><p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">Discover shops around your selected area. Verified listings are clearly labelled so you can see what has been checked.</p><span className="mt-4 inline-flex font-bold text-orange-700">Explore shops <span className="ml-2 transition group-hover:translate-x-1">→</span></span></a>
    </section>

    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-orange-700">Community listings</p><h2 className="mt-1 text-2xl font-extrabold tracking-tight text-[#27231F]">Prices checked by people</h2><p className="mt-1 text-sm text-slate-500">Only approved submissions appear here.</p></div><span className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700">{approvedPrices.length} approved</span></div>
      {approvedPrices.length>0?<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{approvedPrices.map((s:any,i:number)=><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={s.saved||i}><div className="flex items-start justify-between gap-3"><h3 className="font-bold text-slate-900">{s.product}</h3><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">✓ Approved</span></div><p className="mt-3 text-2xl font-black tracking-tight text-orange-700">{money(Number(s.price))}</p><p className="mt-1 text-sm text-slate-600">{s.shop} · {s.area}</p><p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">Price reported: {s.date||'Date not provided'}</p></article>)}</div>:<div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-2xl shadow-sm">🧾</span><h3 className="mt-4 text-lg font-extrabold text-slate-900">No approved prices yet</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">We won't invent prices or shops. Be one of the first to submit a price and help build a useful local price guide.</p><a href="#/submit" className="mt-5 inline-flex rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white hover:bg-orange-700">Submit the first price →</a></div>}
    </section>

    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-orange-700">Around you</p><h2 className="mt-1 text-2xl font-extrabold tracking-tight text-[#27231F]">Verified nearby shops</h2><p className="mt-1 text-sm text-slate-500">Listings shown here have been marked verified.</p></div><a href="#/shops" className="text-sm font-bold text-orange-700 hover:underline">View shops →</a></div>
      {verifiedShops.length>0?<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{verifiedShops.map((s:Shop&{verified?:boolean})=><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={s.id}><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange-50 text-xl">🏪</span><div className="min-w-0"><h3 className="font-bold text-slate-900">{s.name}</h3><p className="mt-1 text-sm text-slate-500">{s.area} · {c.dist(s).toFixed(1)} km away</p></div><span className="ml-auto rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">Verified</span></div></article>)}</div>:<div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-9 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-2xl shadow-sm">🏪</span><h3 className="mt-3 font-extrabold text-slate-900">No verified shops in this view yet</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">We only show shops added by users and marked verified. Help grow the directory by adding a real shop.</p><a href="#/shops" className="mt-4 inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 hover:border-orange-300">Add a shop →</a></div>}
    </section>
    {pendingPrices>0&&<p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">{pendingPrices} price submission{pendingPrices===1?' is':'s are'} still awaiting review and won't appear in the approved listings yet.</p>}
  </div>
}

function Search({q,cat,...c}:C){
  const [text,setText]=useState(q),[sort,setSort]=useState('price');useEffect(()=>setText(q),[q])
  const reports=(c.subs||[]).filter((r:any)=>r.status==='Approved'&&(!q||String(r.product).toLowerCase().includes(q.toLowerCase()))&&(!cat||String(r.category||'Other')===cat))
  const groups=Object.values(reports.reduce((acc:any,r:any)=>{const key=[r.product,r.country,r.currency].join('|');if(!acc[key])acc[key]={key,product:r.product,country:r.country,currency:r.currency||'USD',reports:[]};acc[key].reports.push(r);return acc},{})).map((g:any)=>({...g,reports:g.reports.sort((a:any,b:any)=>a.price-b.price)}))
  const results=groups.sort((a:any,b:any)=>sort==='price'?(a.reports[0]?.price||0)-(b.reports[0]?.price||0):String(a.country).localeCompare(String(b.country)))
  return <div><form className="mb-4 flex gap-2" role="search" onSubmit={e=>{e.preventDefault();go('/search?q='+encodeURIComponent(text)+(cat?'&cat='+encodeURIComponent(cat):''))}}><input aria-label="Search" className="inp" value={text} onChange={e=>setText(e.target.value)} placeholder="Search verified community prices worldwide"/><button className="btn">Search</button></form>
    <div className="mb-4 flex flex-wrap items-center gap-2"><span className="chip">Approved real reports only</span><select aria-label="Sort" className="ml-auto rounded-lg border px-2 py-1 text-sm" value={sort} onChange={e=>setSort(e.target.value)}><option value="price">Lowest price in each currency</option><option value="country">Country</option></select></div>
    {!results.length?<Empty t="No approved prices found" d="Try another search, or submit a real price you have checked. We do not generate sample prices."/>:<div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">{results.map((g:any)=><article className="card" key={g.key}><span className="chip">{g.country}</span><h2 className="mt-2 font-bold">{g.product}</h2><p className="mt-2 text-2xl font-extrabold text-deep">{money(g.reports[0].price,g.currency)}</p><p className="mt-1 text-sm text-mute">Lowest approved report in {g.currency} · {g.reports[0].shop}</p><p className="mt-2 text-xs text-mute">{g.reports.length} approved report(s) · {g.reports[0].area}</p></article>)}</div>}</div>
}

function Detail({id,...c}:C){
  const p=PRODUCTS.find(x=>x.id===id)
  const [target,setTarget]=useState('')
  if(!p)return <Empty t="Product not found" d="This product has not been added to the catalogue yet."/>
  const offers=offersFor(p).sort((a,b)=>a.price-b.price),h=history(p)
  const mn=Math.min(...h.map(x=>x.price)),mx=Math.max(...h.map(x=>x.price))
  const pts=h.map((x,i)=>`${i*40+10},${70-((x.price-mn)/((mx-mn)||1))*60}`).join(' ')
  const al=c.alerts[p.id]
  return <div className="space-y-6"><div><span className="chip">{p.cat}</span><h1 className="mt-2 text-2xl font-extrabold">{p.name}</h1>
    <div className="mt-3 flex flex-wrap gap-2"><button className="btn2" onClick={()=>c.toggleSave(p.id)}>{c.saved.includes(p.id)?'★ Saved':'☆ Save'}</button><button className="btn" onClick={()=>c.setBasket({...c.basket,[p.id]:(c.basket[p.id]||0)+1})}>Add to basket</button></div></div>
    <section className="card"><h2 className="font-bold">Specifications</h2><ul className="mt-2 list-disc pl-5 text-sm text-mute">{p.specs.map(s=><li key={s}>{s}</li>)}</ul></section>
    <section><h2 className="mb-2 font-bold">Compare sellers (same product)</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-mute"><tr><th className="p-2">Shop</th><th>Price</th><th>Distance</th><th>Updated</th><th/></tr></thead><tbody>
      {offers.map((o,i)=><tr key={o.shop.id} className="border-t"><td className="p-2 font-medium">{o.shop.name}, {o.shop.area}{i===0&&<span className="chip ml-2">Lowest</span>}</td><td className="font-bold">{money(o.price)}</td><td>{c.dist(o.shop).toFixed(1)} km</td><td className="text-mute">{o.updated}</td><td><a className="text-deep underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/directions?from=${c.loc.lat},${c.loc.lng}&to=${o.shop.lat},${o.shop.lng}`}>Directions</a></td></tr>)}</tbody></table></div>
      <p className="mt-1 text-xs text-mute">Submitted prices are not a guarantee of current availability.</p></section>
    <section className="card"><h2 className="font-bold">Price history</h2><svg viewBox="0 0 300 80" className="mt-2 w-full" role="img" aria-label={`Sample price history from ${money(h[0].price)} to ${money(h[h.length-1].price)}`}><polyline fill="none" stroke="#F0643B" strokeWidth="3" points={pts}/></svg>
      <p className="text-xs text-mute">Low {money(mn)} · High {money(mx)} · History will appear after verified price reports are collected</p></section>
    <section className="card"><h2 className="font-bold">Price alert</h2><p className="text-sm text-mute">Stored on this device only. No notifications are sent in this demo; you'll see a flag on the Saved page.</p>
      <div className="mt-2 flex gap-2"><input className="inp" inputMode="numeric" aria-label="Target price in NGN" placeholder="Target price (₦)" value={target} onChange={e=>setTarget(e.target.value)}/><button className="btn" onClick={()=>{const n=Number(target);if(n>0)c.setAlerts({...c.alerts,[p.id]:n})}}>Set</button></div>
      {al&&<p className="mt-2 text-sm">Alert at {money(al)} · <button className="underline" onClick={()=>{const n={...c.alerts};delete n[p.id];c.setAlerts(n)}}>remove</button></p>}</section></div>
}

function Shops(c:C){
  const list=[...c.shops].sort((a:any,b:any)=>c.dist(a)-c.dist(b))
  const [formError,setFormError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false)
  const saveShop=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();setFormError('');setNotice('')
    if(!c.account?.id){setFormError('Please log in before registering a shop.');return}
    const form=e.currentTarget,f=new FormData(form)
    const name=String(f.get('name')||'').trim(),address=String(f.get('address')||'').trim()
    const city=String(f.get('city')||'').trim(),country=String(f.get('country')||'').trim()
    const rawLat=String(f.get('lat')||'').trim(),rawLng=String(f.get('lng')||'').trim()
    if(!name||!address||!city||!country){setFormError('Enter the real shop name, address, city and country.');return}
    if(rawLat===''||rawLng===''){setFormError('Enter the shop’s actual latitude and longitude. Use your device location only if you are physically at the shop.');return}
    const lat=Number(rawLat),lng=Number(rawLng)
    if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -90||lat>90||lng < -180||lng>180){setFormError('Enter valid latitude and longitude coordinates.');return}
    setBusy(true)
    try{
      await dbRequest('shops',{method:'POST',account:c.account,query:'select=*',prefer:'return=representation',body:{owner_id:c.account.id,name,address,city,country,latitude:lat,longitude:lng,verification_status:'pending'}})
      await c.refreshSharedData();form.reset();setNotice('Shop submitted to the shared database. It is pending verification and is not yet shown as verified.')
    }catch(err){setFormError(err instanceof Error?err.message:'Could not save the shop. Please try again.')}
    finally{setBusy(false)}
  }
  return <div className="space-y-4"><h1 className="text-2xl font-extrabold">Shops around the world</h1><p className="text-sm text-mute">Register a real shop in any country. New registrations are shared through Supabase and remain pending until verified.</p>
    <MapView center={c.loc} loc={c.loc} shops={list}/>
    <form className="card space-y-3" onSubmit={saveShop}><h2 className="font-bold">Register a real shop</h2>
      {!c.account&&<p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Log in first to submit a shop.</p>}
      <label className="block text-sm font-medium">Shop name<input required name="name" className="inp mt-1" placeholder="Real shop or business name"/></label>
      <label className="block text-sm font-medium">Street address<input required name="address" className="inp mt-1" placeholder="Street address or shop location"/></label>
      <div className="grid grid-cols-2 gap-3"><label className="block text-sm font-medium">City<input required name="city" defaultValue={c.city} className="inp mt-1" placeholder="City"/></label><label className="block text-sm font-medium">Country<input required name="country" defaultValue={c.country} className="inp mt-1" placeholder="Country"/></label></div>
      <p className="text-xs text-mute">Coordinates must be for the actual shop location. We require them to avoid pinning international shops in the wrong country.</p>
      <div className="grid grid-cols-2 gap-3"><label className="block text-sm font-medium">Latitude<input required name="lat" type="number" step="any" className="inp mt-1" placeholder="e.g. 6.5244"/></label><label className="block text-sm font-medium">Longitude<input required name="lng" type="number" step="any" className="inp mt-1" placeholder="e.g. 3.3792"/></label></div>
      {formError&&<p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{formError}</p>}
      {notice&&<p role="status" className="rounded-lg bg-orange-50 p-2 text-sm text-orange-800">{notice}</p>}
      <button disabled={busy||!c.account} type="submit" className="btn w-full">{busy?'Saving…':'Submit shop for verification'}</button>
    </form>
    {list.length?<ul className="grid gap-3 sm:grid-cols-2">{list.map((s:any)=><li key={s.id} className="card"><p className="font-semibold">{s.name}</p><p className="text-sm text-mute">{s.area} · {c.dist(s).toFixed(1)} km away · {s.verified?'Verified':'Pending verification'}</p><a className="btn2 mt-2 inline-block" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/directions?from=${c.loc.lat},${c.loc.lng}&to=${s.lat},${s.lng}`}>Get directions</a></li>)}</ul>:<Empty t="No verified shops in this view yet" d="There are no built-in sample shops. Real shops will appear here after they are registered and verified."/>}
  </div>
}
function Basket(c:C){
  const items=PRODUCTS.filter(p=>c.basket[p.id])
  if(!items.length)return <Empty t="Your basket is empty" d="Add products from their detail pages to compare totals per shop."/>
  const totals=SHOPS.map(s=>{let t=0,miss=0;items.forEach(p=>{const o=offersFor(p).find(x=>x.shop.id===s.id);o?t+=o.price*c.basket[p.id]:miss++});return{s,t,miss}}).sort((a,b)=>a.miss-b.miss||a.t-b.t)
  return <div className="space-y-5"><h1 className="text-2xl font-extrabold">Smart basket <Demo/></h1>
    <ul className="space-y-2">{items.map(p=><li key={p.id} className="card flex items-center justify-between gap-2"><a href={'#/p/'+p.id} className="font-medium">{p.name}</a>
      <span className="flex items-center gap-2"><input aria-label={`Quantity for ${p.name}`} type="number" min={1} className="inp !w-16" value={c.basket[p.id]} onChange={e=>c.setBasket({...c.basket,[p.id]:Math.max(1,Number(e.target.value)||1)})}/><button aria-label="Remove" onClick={()=>{const n={...c.basket};delete n[p.id];c.setBasket(n)}}>🗑</button></span></li>)}</ul>
    <h2 className="font-bold">Totals by shop</h2><ul className="space-y-2">{totals.map((x,i)=><li key={x.s.id} className="card flex justify-between"><span>{x.s.name} <span className="text-xs text-mute">· {c.dist(x.s).toFixed(1)} km</span>{x.miss>0&&<span className="ml-2 text-xs text-red-600">missing {x.miss} item(s)</span>}{i===0&&<span className="chip ml-2">Best</span>}</span><b>{money(x.t)}</b></li>)}</ul>
    <button className="btn2" onClick={()=>c.setBasket({})}>Clear basket</button></div>
}

function Saved(c:C){
  const items=PRODUCTS.filter(p=>c.saved.includes(p.id))
  const alerted=PRODUCTS.filter(p=>c.alerts[p.id])
  return <div className="space-y-6"><h1 className="text-2xl font-extrabold">Saved & alerts</h1>
    {items.length?<div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">{items.map(p=><Card key={p.id} p={p} c={c}/>)}</div>:<Empty t="Nothing saved yet" d="Tap ☆ on any product to keep it here."/>}
    {alerted.length>0&&<section><h2 className="mb-2 font-bold">Price alerts (local only)</h2><ul className="space-y-2">{alerted.map(p=>{const b=best(p).price,hit=b<=c.alerts[p.id];return <li key={p.id} className="card flex justify-between"><a href={'#/p/'+p.id}>{p.name}</a><span className={hit?'font-bold text-brand':'text-mute'}>{hit?`Target reached: ${money(b)}`:`Target ${money(c.alerts[p.id])} · now ${money(b)}`}</span></li>})}</ul></section>}</div>
}


function Admin(c:C){
  return <div className="mx-auto max-w-2xl space-y-4"><h1 className="text-2xl font-extrabold">Secure verification</h1><div className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950"><b>Administrator approval is locked until secure admin roles are configured.</b> This is intentional: a normal user must not be able to approve their own shop or price report. New submissions are stored in Supabase as pending and are shared according to the database access policies. Do not trust or label pending entries as verified.</div><p className="text-sm text-mute">Next, configure a server-side administrator role and restricted review policies in Supabase. Until that is done, do not approve records by changing browser state.</p><button className="btn2" onClick={c.refreshSharedData}>Refresh shared submissions</button></div>
}

function Submit(c:C){
  const blank=()=>({product:'',shop:'',area:'',price:'',date:new Date().toISOString().slice(0,10),country:c.country||'',currency:c.currency||'USD'})
  const [f,setF]=useState(blank),[done,setDone]=useState(false),[err,setErr]=useState(''),[busy,setBusy]=useState(false)
  const set=(k:string,v:string)=>setF((old:any)=>({...old,[k]:v}))
  const submit=async(e:FormEvent)=>{
    e.preventDefault();setErr('');setDone(false)
    if(!c.account?.id){setErr('Please log in before submitting a price.');return}
    const price=Number(f.price)
    if(!f.product.trim()||!f.shop.trim()||!f.area.trim()||!f.country.trim()||!f.currency.trim()||!Number.isFinite(price)||price<=0){setErr('Enter the product, shop, location, country, currency and a price greater than zero.');return}
    if(!f.date||f.date>new Date().toISOString().slice(0,10)){setErr('Choose a valid date that is today or earlier.');return}
    setBusy(true)
    try{
      await dbRequest('price_reports',{method:'POST',account:c.account,query:'select=*',prefer:'return=representation',body:{submitted_by:c.account.id,product_name:f.product.trim(),shop_id:null,shop_name:f.shop.trim(),location:f.area.trim(),country:f.country.trim(),currency_code:f.currency,price,date_seen:f.date,verification_status:'pending'}})
      await c.refreshSharedData();setDone(true);setF(blank())
    }catch(e){setErr(e instanceof Error?e.message:'Could not save the price report. Please try again.')}
    finally{setBusy(false)}
  }
  return <div className="mx-auto max-w-xl space-y-4"><h1 className="text-2xl font-extrabold">Submit a real price</h1>
    <p className="text-sm text-mute">Report the price you actually saw in a shop anywhere in the world. Reports are stored in the shared database and remain pending until reviewed.</p>
    {!c.account&&<p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Log in first to submit a price report.</p>}
    {done&&<p role="status" className="rounded-xl bg-soft p-3 text-sm text-deep">Your price report was saved to the shared database and is pending verification.</p>}
    {err&&<p role="alert" className="text-sm text-red-600">{err}</p>}
    <form onSubmit={submit} className="card space-y-3">
      <label className="block text-sm font-medium">Product name<input required className="inp mt-1" value={f.product} onChange={e=>set('product',e.target.value)} placeholder="Exact product name and size"/></label>
      <label className="block text-sm font-medium">Shop name<input required className="inp mt-1" value={f.shop} onChange={e=>set('shop',e.target.value)} placeholder="Real shop where you checked"/></label>
      <label className="block text-sm font-medium">Shop location / address<input required className="inp mt-1" value={f.area} onChange={e=>set('area',e.target.value)} placeholder="Address or neighbourhood, city"/></label>
      <div className="grid grid-cols-2 gap-3"><label className="block text-sm font-medium">Country<input required className="inp mt-1" value={f.country} onChange={e=>set('country',e.target.value)} placeholder="Country"/></label><label className="block text-sm font-medium">Currency<select required className="inp mt-1" value={f.currency} onChange={e=>set('currency',e.target.value)}>{['NGN','GHS','KES','ZAR','GBP','USD','CAD','EUR','INR','AUD','Other'].map(code=><option key={code} value={code}>{code}</option>)}</select></label></div>
      <label className="block text-sm font-medium">Price<input required min="0.01" step="0.01" inputMode="decimal" className="inp mt-1" type="number" value={f.price} onChange={e=>set('price',e.target.value)} placeholder="Actual shelf or checkout price"/></label>
      <label className="block text-sm font-medium">Date seen<input required className="inp mt-1" type="date" max={new Date().toISOString().slice(0,10)} value={f.date} onChange={e=>set('date',e.target.value)}/></label>
      <button disabled={busy||!c.account} type="submit" className="btn w-full">{busy?'Submitting…':'Submit price report'}</button>
    </form>
    {c.subs.length>0&&<section><h2 className="mb-2 font-bold">Shared price reports</h2><ul className="space-y-2">{c.subs.map((r:any)=><li key={r.id} className="card text-sm"><p className="font-semibold">{r.product}</p><p>{money(Number(r.price),r.currency||'USD')} · {r.shop}, {r.area} · {r.date}</p><p className="mt-1 text-xs text-amber-800">{r.status}</p></li>)}</ul></section>}
  </div>
}
