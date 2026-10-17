import {useEffect,useMemo,useRef,useState} from 'react'
import type {FormEvent} from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {AREAS,CATS,CUR,SHOPS,PRODUCTS,offersFor,history,change,km,Loc,Product,Shop} from './data'

function useLS<T>(k:string,init:T):[T,(v:T)=>void]{
  const [v,s]=useState<T>(()=>{try{const x=localStorage.getItem('pp:'+k);return x?JSON.parse(x):init}catch{return init}})
  return [v,(n:T)=>{s(n);try{localStorage.setItem('pp:'+k,JSON.stringify(n))}catch{/* storage unavailable */}}]
}
const money=(n:number,c='NGN')=>`${CUR[c].symbol}${Math.round(n*CUR[c].rate).toLocaleString('en-NG')}`
const Demo=()=><span className="chip" title="Sample data, not real prices">Demo data</span>
const go=(p:string)=>{location.hash=p}
const best=(p:Product)=>offersFor(p).reduce((a,b)=>a.price<b.price?a:b)

function MapView({center,loc,shops}:{center:Loc;loc:Loc;shops:Shop[]}){
  const el=useRef<HTMLDivElement>(null)
  useEffect(()=>{
    if(!el.current)return
    const m=L.map(el.current).setView([center.lat,center.lng],12)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}).addTo(m)
    L.circleMarker([loc.lat,loc.lng],{radius:9,color:'#087443',fillColor:'#0BA95B',fillOpacity:1}).addTo(m).bindPopup('Your selected location')
    shops.forEach(s=>L.circleMarker([s.lat,s.lng],{radius:7,color:'#17211B',fillColor:'#fff',fillOpacity:1}).addTo(m).bindPopup(`${s.name}<br/>${s.area}<br/>${km(loc,s).toFixed(1)} km · Not verified`))
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
  const [subs,setSubs]=useLS<any[]>('subs',[])
  const [shops,setShops]=useLS<Shop[]>('shops',[])
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
  const ctx={loc,saved,toggleSave,alerts,setAlerts,basket,setBasket,subs,setSubs,shops,setShops,dist}

  const links=[['','Home'],['search','Search'],['shops','Shops'],['basket','Basket'],['saved','Saved'],['submit','Submit price']]
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
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm"><span className="text-mute">📍 {loc.name}</span>
        <select aria-label="Choose area" className="rounded-lg border px-2 py-1" value={AREAS.some(a=>a.name===loc.name)?loc.name:''} onChange={e=>{const a=AREAS.find(x=>x.name===e.target.value);if(a){setLoc(a);setGeoMsg('')}}}><option value="" disabled>Choose area</option>{AREAS.map(a=><option key={a.name}>{a.name}</option>)}</select>
        <button className="btn2 !py-1" onClick={locate}>Use my location</button>
        <span className="text-mute">Currency: NGN</span></div>
      {geoMsg&&<p role="status" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{geoMsg}</p>}
      {route===''&&<Home q={q} setQ={setQ} {...ctx}/>}
      {route==='search'&&<Search {...ctx} q={new URLSearchParams(hash.includes('?')?hash.slice(hash.indexOf('?')+1):'').get('q')||''} cat={new URLSearchParams(hash.includes('?')?hash.slice(hash.indexOf('?')+1):'').get('cat')||''}/>}
      {route==='p'&&<Detail id={arg} {...ctx}/>}
      {route==='shops'&&<Shops {...ctx}/>}
      {route==='basket'&&<Basket {...ctx}/>}
      {route==='saved'&&<Saved {...ctx}/>}
      {route==='submit'&&<Submit {...ctx}/>}
      {!['','search','p','shops','basket','saved','submit'].includes(route)&&<Empty t="Page not found" d="That page doesn't exist."/>}
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
  const [load,setLoad]=useState(true)
  useEffect(()=>{const t=setTimeout(()=>setLoad(false),500);return()=>clearTimeout(t)},[])
  const nearby=useMemo(()=>[...PRODUCTS].sort((a,b)=>c.dist(best(a).shop)-c.dist(best(b).shop)).slice(0,4),[c.loc])
  const moves=[...PRODUCTS].sort((a,b)=>Math.abs(change(b).pct)-Math.abs(change(a).pct)).slice(0,4)
  return <div className="space-y-8">
    <section className="rounded-3xl bg-gradient-to-br from-deep to-brand p-6 text-white md:p-10">
      <h1 className="text-3xl font-extrabold md:text-4xl">Know the price.<br/>Compare the world.<br/>Save smarter.</h1>
      <p className="mt-2 text-sm text-green-50">Starting in Lagos, Nigeria. Real listings will appear as shops and shoppers submit information.</p>
      <form className="mt-5 flex gap-2" role="search" onSubmit={e=>{e.preventDefault();go('/search?q='+encodeURIComponent(q))}}>
        <input aria-label="Search products" className="inp !text-ink" placeholder="Search rice, phone, TV, fan…" value={q} onChange={e=>setQ(e.target.value)}/>
        <button className="btn !bg-ink">Search</button></form></section>
    <section><h2 className="mb-3 text-lg font-bold">Categories</h2><div className="flex flex-wrap gap-2">{CATS.map(k=><a key={k} className="btn2" href={'#/search?q=&cat='+k}>{k}</a>)}</div></section>
    {load?<div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">{[1,2,3,4].map(i=><div key={i} className="sk"/>)}</div>:<>
    <section><h2 className="mb-3 text-lg font-bold">Nearby prices</h2><div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">{nearby.map(p=><Card key={p.id} p={p} c={c}/>)}</div></section>
    <section><h2 className="mb-3 text-lg font-bold">Recent price changes</h2><div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">{moves.map(p=><Card key={p.id} p={p} c={c}/>)}</div></section></>}
  </div>
}

function Search({q,cat,...c}:C){
  const [load,setLoad]=useState(true),[err,setErr]=useState(false),[sort,setSort]=useState('price'),[tick,setTick]=useState(0)
  useEffect(()=>{setLoad(true);const t=setTimeout(()=>{setLoad(false)},350);return()=>clearTimeout(t)},[q,cat,tick])
  const [text,setText]=useState(q);useEffect(()=>setText(q),[q])
  let res=PRODUCTS.filter(p=>(!q||p.name.toLowerCase().includes(q.toLowerCase())||p.cat.toLowerCase().includes(q.toLowerCase()))&&(!cat||p.cat===cat))
  res=[...res].sort((a,b)=>sort==='price'?best(a).price-best(b).price:c.dist(best(a).shop)-c.dist(best(b).shop))
  return <div><form className="mb-4 flex gap-2" role="search" onSubmit={e=>{e.preventDefault();go('/search?q='+encodeURIComponent(text)+(cat?'&cat='+encodeURIComponent(cat):''))}}><input aria-label="Search" className="inp" value={text} onChange={e=>setText(e.target.value)} placeholder="Search products"/><button className="btn">Search</button></form>
    <div className="mb-4 flex flex-wrap items-center gap-2"><a className={`chip ${!cat?'!bg-brand !text-white':''}`} href={'#/search?q='+encodeURIComponent(q)}>All</a>{CATS.map(k=><a key={k} className={`chip ${cat===k?'!bg-brand !text-white':''}`} href={`#/search?q=${encodeURIComponent(q)}&cat=${encodeURIComponent(k)}`}>{k}</a>)}
      <select aria-label="Sort" className="ml-auto rounded-lg border px-2 py-1 text-sm" value={sort} onChange={e=>setSort(e.target.value)}><option value="price">Lowest price</option><option value="dist">Nearest</option></select></div>
    {err?<div role="alert" className="card text-center"><p>Something went wrong loading results.</p><button className="btn mt-2" onClick={()=>{setErr(false);setTick(tick+1)}}>Retry</button></div>
    :load?<div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">{[1,2,3].map(i=><div key={i} className="sk"/>)}</div>
    :res.length===0?<Empty t="No products found" d="Try another word or category. No matching product is listed yet."/>
    :<div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">{res.map(p=><Card key={p.id} p={p} c={c}/>)}</div>}</div>
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
    <section className="card"><h2 className="font-bold">Price history</h2><svg viewBox="0 0 300 80" className="mt-2 w-full" role="img" aria-label={`Sample price history from ${money(h[0].price)} to ${money(h[h.length-1].price)}`}><polyline fill="none" stroke="#0BA95B" strokeWidth="3" points={pts}/></svg>
      <p className="text-xs text-mute">Low {money(mn)} · High {money(mx)} · History will appear after verified price reports are collected</p></section>
    <section className="card"><h2 className="font-bold">Price alert</h2><p className="text-sm text-mute">Stored on this device only. No notifications are sent in this demo; you'll see a flag on the Saved page.</p>
      <div className="mt-2 flex gap-2"><input className="inp" inputMode="numeric" aria-label="Target price in NGN" placeholder="Target price (₦)" value={target} onChange={e=>setTarget(e.target.value)}/><button className="btn" onClick={()=>{const n=Number(target);if(n>0)c.setAlerts({...c.alerts,[p.id]:n})}}>Set</button></div>
      {al&&<p className="mt-2 text-sm">Alert at {money(al)} · <button className="underline" onClick={()=>{const n={...c.alerts};delete n[p.id];c.setAlerts(n)}}>remove</button></p>}</section></div>
}

function Shops(c:C){
  const list=[...c.shops].sort((a:Shop,b:Shop)=>c.dist(a)-c.dist(b))
  const [formError,setFormError]=useState('')
  const [notice,setNotice]=useState('')
  const saveShop=(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault()
    const form=e.currentTarget
    const f=new FormData(form)
    const name=String(f.get('name')||'').trim()
    const area=String(f.get('area')||'').trim()
    const rawLat=String(f.get('lat')||'').trim()
    const rawLng=String(f.get('lng')||'').trim()
    const lat=rawLat===''?c.loc.lat:Number(rawLat)
    const lng=rawLng===''?c.loc.lng:Number(rawLng)
    if(!name||!area){setFormError('Enter the shop name and address/area.');return}
    if((rawLat==='')!==(rawLng==='')){setFormError('Enter both latitude and longitude, or leave both blank.');return}
    if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -90||lat>90||lng < -180||lng>180){setFormError('Enter valid coordinates, or leave both blank to use your selected location.');return}
    const shop:Shop={id:typeof crypto!=='undefined'&&'randomUUID' in crypto?crypto.randomUUID():String(Date.now()),name,area,lat,lng}
    c.setShops([...c.shops,shop])
    form.reset()
    setFormError('')
    setNotice('Shop saved on this device. It is not yet shared or verified.')
  }
  return <div className="space-y-4"><h1 className="text-2xl font-extrabold">Nearby shops</h1><p className="text-sm text-mute">Add real shop details below. Shops saved here are stored only in this browser and are not shared or verified.</p>
    <MapView center={c.loc} loc={c.loc} shops={list}/>
    <form className="card space-y-3" onSubmit={saveShop}><h2 className="font-bold">Add a shop</h2>
      <label className="block text-sm font-medium">Shop name<input required name="name" className="inp mt-1" placeholder="Real shop or business name"/></label>
      <label className="block text-sm font-medium">Address / area<input required name="area" className="inp mt-1" placeholder="Street, neighbourhood, city"/></label>
      <p className="text-xs text-mute">Coordinates are optional. Leave both blank to use your currently selected location, or enter the shop's actual coordinates for a more accurate map pin.</p>
      <div className="grid grid-cols-2 gap-3"><label className="block text-sm font-medium">Latitude<input name="lat" type="number" step="any" className="inp mt-1" placeholder="Optional, e.g. 6.5244"/></label><label className="block text-sm font-medium">Longitude<input name="lng" type="number" step="any" className="inp mt-1" placeholder="Optional, e.g. 3.3792"/></label></div>
      {formError&&<p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{formError}</p>}
      {notice&&<p role="status" className="rounded-lg bg-green-50 p-2 text-sm text-green-800">{notice}</p>}
      <button type="submit" className="btn w-full">Save shop</button>
    </form>
    {list.length?<ul className="grid gap-3 sm:grid-cols-2">{list.map((s:Shop)=><li key={s.id} className="card"><p className="font-semibold">{s.name}</p><p className="text-sm text-mute">{s.area} · {c.dist(s).toFixed(1)} km away · Not verified</p><div className="mt-2 flex gap-2"><a className="btn2" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/directions?from=${c.loc.lat},${c.loc.lng}&to=${s.lat},${s.lng}`}>Get directions</a><button type="button" className="btn2" onClick={()=>c.setShops(c.shops.filter((x:Shop)=>x.id!==s.id))}>Remove</button></div></li>)}</ul>:<Empty t="No shops added yet" d="There are no built-in sample shops. Add a real shop using the form above."/ >}</div>
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

function Submit(c:C){
  const blank=()=>({product:'',shop:'',area:c.loc.name,price:'',date:new Date().toISOString().slice(0,10),receipt:''})
  const [f,setF]=useState(blank)
  const [done,setDone]=useState(false),[err,setErr]=useState('')
  const set=(k:string,v:string)=>setF({...f,[k]:v})
  const submit=(e:FormEvent)=>{e.preventDefault();const price=Number(f.price)
    if(!f.product.trim()||!f.shop.trim()||!f.area.trim()||!Number.isFinite(price)||price<=0){setErr('Enter the product, shop, location and a price greater than zero.');return}
    if(!f.date||f.date>new Date().toISOString().slice(0,10)){setErr('Choose a valid date that is today or earlier.');return}
    const record={...f,price,saved:new Date().toISOString(),status:'Pending verification'}
    setErr('');c.setSubs([record,...c.subs]);setDone(true);setF(blank())
  }
  return <div className="mx-auto max-w-xl space-y-4"><h1 className="text-2xl font-extrabold">Submit a price</h1>
    <p className="text-sm text-mute">Help people compare real prices by reporting what you actually saw at a shop. Do not guess or invent prices.</p>
    <p role="note" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><b>Local testing only:</b> submissions are saved in this browser and are not shared with other users yet. They remain unverified. Receipt files are not uploaded; only the file name is kept.</p>
    {done&&<p role="status" className="rounded-xl bg-soft p-3 text-sm text-deep">Price report saved on this device and marked pending verification. <button className="underline" onClick={()=>setDone(false)}>Dismiss</button></p>}
    {err&&<p role="alert" className="text-sm text-red-600">{err}</p>}
    <form onSubmit={submit} className="card space-y-3">
      <label className="block text-sm font-medium">Product name<input required className="inp mt-1" type="text" value={f.product} onChange={e=>set('product',e.target.value)} placeholder="e.g. 1 kg bag of rice"/></label>
      <label className="block text-sm font-medium">Shop name<input required className="inp mt-1" type="text" value={f.shop} onChange={e=>set('shop',e.target.value)} placeholder="Name of the shop where you checked"/></label>
      <label className="block text-sm font-medium">Location / area<input required className="inp mt-1" type="text" value={f.area} onChange={e=>set('area',e.target.value)} placeholder="Neighbourhood, city, country"/></label>
      <label className="block text-sm font-medium">Price (NGN)<input required min="0.01" step="0.01" inputMode="decimal" className="inp mt-1" type="number" value={f.price} onChange={e=>set('price',e.target.value)} placeholder="Actual shelf or checkout price"/></label>
      <label className="block text-sm font-medium">Date seen<input required className="inp mt-1" type="date" max={new Date().toISOString().slice(0,10)} value={f.date} onChange={e=>set('date',e.target.value)}/></label>
      <label className="block text-sm font-medium">Receipt (optional)<input className="inp mt-1" type="file" accept="image/*,.pdf" onChange={e=>set('receipt',e.target.files?.[0]?.name||'')}/></label>
      <button type="submit" className="btn w-full">Submit price report</button></form>
    {c.subs.length>0&&<section><h2 className="mb-2 font-bold">Your price reports</h2><p className="mb-2 text-xs text-mute">These reports are private to this browser and do not appear as verified public prices.</p><ul className="space-y-2">{c.subs.map((s:any,i:number)=><li key={s.saved||i} className="card text-sm"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{s.product}</p><p>{money(Number(s.price))} · {s.shop}, {s.area} · {s.date}</p><p className="mt-1 text-xs text-amber-800">{s.status||'Pending verification'}</p></div><button type="button" className="btn2" onClick={()=>c.setSubs(c.subs.filter((_:any,j:number)=>j!==i))}>Remove</button></div></li>)}</ul></section>}</div>
}
