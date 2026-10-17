// No sample shop or price records are shipped. Listings appear only after real data is added.
export type Loc={name:string;lat:number;lng:number}
export const CUR:Record<string,{symbol:string;rate:number}>={NGN:{symbol:'₦',rate:1}} // add currencies/rates here
export const COUNTRIES=[{code:'NG',name:'Nigeria',currency:'NGN',cities:['Lagos']}] // expansion point
export const AREAS:Loc[]=[{name:'Ikeja, Lagos',lat:6.6018,lng:3.3515},{name:'Yaba, Lagos',lat:6.5095,lng:3.3711},{name:'Lekki, Lagos',lat:6.4698,lng:3.5852},{name:'Victoria Island, Lagos',lat:6.4281,lng:3.4219},{name:'Surulere, Lagos',lat:6.5009,lng:3.3569},{name:'Ajah, Lagos',lat:6.4698,lng:3.5852+0.1}]
export const CATS=['Groceries','Phones','Electronics','Clothing','Appliances','Beauty','Other'] as const
export type Shop={id:string;name:string;area:string;lat:number;lng:number}
export const SHOPS:Shop[]=[]
export type Product={id:string;name:string;cat:string;base:number;specs:string[]}
export const PRODUCTS:Product[]=[]
const r50=(n:number)=>Math.round(n/50)*50
export const offersFor=(p:Product)=>[] as {shop:Shop;price:number;updated:string}[]
export const history=(p:Product)=>[] as {label:string;price:number}[]
export const change=(p:Product)=>({pct:0,now:0})
export const km=(a:{lat:number;lng:number},b:{lat:number;lng:number})=>{const R=6371,t=(x:number)=>x*Math.PI/180,dl=t(b.lat-a.lat),dg=t(b.lng-a.lng);const h=Math.sin(dl/2)**2+Math.cos(t(a.lat))*Math.cos(t(b.lat))*Math.sin(dg/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
