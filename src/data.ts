// ALL DATA BELOW IS DEMO/SAMPLE DATA. Not real shops, prices, stock or reviews.
export type Loc={name:string;lat:number;lng:number}
export const CUR:Record<string,{symbol:string;rate:number}>={NGN:{symbol:'₦',rate:1}} // add currencies/rates here
export const COUNTRIES=[{code:'NG',name:'Nigeria',currency:'NGN',cities:['Lagos']}] // expansion point
export const AREAS:Loc[]=[{name:'Ikeja, Lagos',lat:6.6018,lng:3.3515},{name:'Yaba, Lagos',lat:6.5095,lng:3.3711},{name:'Lekki, Lagos',lat:6.4698,lng:3.5852},{name:'Victoria Island, Lagos',lat:6.4281,lng:3.4219},{name:'Surulere, Lagos',lat:6.5009,lng:3.3569},{name:'Ajah, Lagos',lat:6.4698,lng:3.5852+0.1}]
export const CATS=['Groceries','Phones','Electronics','Clothing','Appliances','Beauty','Other'] as const
export type Shop={id:string;name:string;area:string;lat:number;lng:number}
export const SHOPS:Shop[]=[
{id:'s1',name:'Demo Shop A',area:'Ikeja',lat:6.6050,lng:3.3490},{id:'s2',name:'Demo Shop B',area:'Yaba',lat:6.5120,lng:3.3730},
{id:'s3',name:'Demo Shop C',area:'Lekki',lat:6.4710,lng:3.5700},{id:'s4',name:'Demo Shop D',area:'Victoria Island',lat:6.4300,lng:3.4250},
{id:'s5',name:'Demo Shop E',area:'Surulere',lat:6.4990,lng:3.3580},{id:'s6',name:'Demo Shop F',area:'Ajah',lat:6.4680,lng:3.6000}]
export type Product={id:string;name:string;cat:string;base:number;specs:string[]}
export const PRODUCTS:Product[]=[
{id:'p1',name:'Rice 50kg bag (long grain)',cat:'Groceries',base:85000,specs:['50kg','Long grain','Parboiled']},
{id:'p2',name:'Vegetable oil 5L',cat:'Groceries',base:14500,specs:['5 litres','Cooking oil']},
{id:'p3',name:'Smartphone 128GB (sample model X)',cat:'Phones',base:185000,specs:['128GB storage','6GB RAM','Dual SIM']},
{id:'p4',name:'Smartphone 64GB (sample model Y)',cat:'Phones',base:98000,specs:['64GB storage','4GB RAM','Dual SIM']},
{id:'p5',name:'32-inch LED TV',cat:'Electronics',base:125000,specs:['32 inch','HD','2 HDMI ports']},
{id:'p6',name:'Bluetooth speaker',cat:'Electronics',base:22000,specs:['10h battery','Bluetooth 5.0']},
{id:'p7',name:'Men’s sneakers (size 42)',cat:'Clothing',base:28000,specs:['Size 42','Synthetic']},
{id:'p8',name:'Standing fan 16-inch',cat:'Appliances',base:36000,specs:['16 inch','3 speeds']},
{id:'p9',name:'Microwave oven 20L',cat:'Appliances',base:78000,specs:['20 litres','700W']},
{id:'p10',name:'Shea butter 500g',cat:'Beauty',base:6500,specs:['500g','Unrefined']},
{id:'p11',name:'Power bank 20000mAh',cat:'Other',base:19500,specs:['20000mAh','Dual USB']}]
const r50=(n:number)=>Math.round(n/50)*50
export const offersFor=(p:Product)=>{const n=Number(p.id.slice(1));return SHOPS.filter((_,i)=>(i+n)%6!==0).map((s,i)=>({shop:s,price:r50(p.base*(0.93+((i*5+n*3)%9)*0.016)),updated:'Demo sample'}))}
export const history=(p:Product)=>{const n=Number(p.id.slice(1));return Array.from({length:8},(_,i)=>({label:`W-${7-i}`,price:r50(p.base*(1.03-0.01*i*((n%3)-0.5)+((i*n)%4)*0.008))}))}
export const change=(p:Product)=>{const h=history(p);const a=h[h.length-2].price,b=h[h.length-1].price;return{pct:(b-a)/a*100,now:b}}
export const km=(a:{lat:number;lng:number},b:{lat:number;lng:number})=>{const R=6371,t=(x:number)=>x*Math.PI/180,dl=t(b.lat-a.lat),dg=t(b.lng-a.lng);const h=Math.sin(dl/2)**2+Math.cos(t(a.lat))*Math.cos(t(b.lat))*Math.sin(dg/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
