const URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export type SessionAccount = { id:string; email:string; name:string; access_token?:string; refresh_token?:string }

type StoredSession = { access_token?:string; refresh_token?:string; [key:string]:unknown }

function readSession():StoredSession {
  try { return JSON.parse(localStorage.getItem('pp:authSession') || '{}') } catch { return {} }
}

function token(account?:SessionAccount|null) {
  // Prefer the latest Supabase session, because refresh tokens rotate after renewal.
  const session = readSession()
  return session.access_token || account?.access_token || ''
}

let refreshInFlight:Promise<string|null>|null=null

async function refreshAccessToken():Promise<string|null> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight=(async()=>{
    const session=readSession()
    if(!URL||!KEY||!session.refresh_token) return null
    try {
      const response=await fetch(`${URL}/auth/v1/token?grant_type=refresh_token`,{
        method:'POST',
        headers:{apikey:KEY,'Content-Type':'application/json'},
        body:JSON.stringify({refresh_token:session.refresh_token})
      })
      const data=await response.json().catch(()=>null)
      if(!response.ok||!data?.access_token) return null
      localStorage.setItem('pp:authSession',JSON.stringify(data))
      return data.access_token as string
    } catch { return null }
  })().finally(()=>{refreshInFlight=null})
  return refreshInFlight
}

export async function dbRequest<T=unknown>(table:string, options:{
  method?:string; account?:SessionAccount|null; query?:string; body?:unknown; prefer?:string
} = {}):Promise<T> {
  if (!URL || !KEY) throw new Error('Database is not configured. Check the VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.')

  const send=async(accessToken:string)=>fetch(`${URL}/rest/v1/${table}${options.query ? `?${options.query}` : ''}`,{
    method:options.method||'GET',
    headers:{
      apikey:KEY,
      ...(accessToken?{Authorization:`Bearer ${accessToken}`}:{}),
      'Content-Type':'application/json',
      ...(options.prefer?{Prefer:options.prefer}:{})
    },
    ...(options.body===undefined?{}:{body:JSON.stringify(options.body)})
  })

  let accessToken=token(options.account)
  let response=await send(accessToken)
  let text=await response.text()
  let data=text?(()=>{try{return JSON.parse(text)}catch{return text}})():null

  // Supabase access tokens expire. Renew once and retry the original request.
  const message=typeof data==='object'&&data?String((data as any).message||''):''
  if(response.status===401&&/jwt expired|invalid jwt|token has expired/i.test(message)){
    const renewed=await refreshAccessToken()
    if(renewed){
      response=await send(renewed)
      text=await response.text()
      data=text?(()=>{try{return JSON.parse(text)}catch{return text}})():null
    }else{
      throw new Error('Your sign-in session has expired. Please log in again, then refresh this page.')
    }
  }

  if(!response.ok){
    const errorMessage=typeof data==='object'&&data?((data as any).message||(data as any).details||(data as any).hint):''
    throw new Error(errorMessage||`Database request failed (${response.status}).`)
  }
  return data as T
}

export const isDbConfigured = () => Boolean(URL && KEY)
