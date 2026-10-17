const URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export type SessionAccount = { id:string; email:string; name:string; access_token?:string; refresh_token?:string }

function token(account?:SessionAccount|null) {
  if (account?.access_token) return account.access_token
  try {
    const session = JSON.parse(localStorage.getItem('pp:authSession') || '{}')
    return session.access_token || KEY
  } catch { return KEY }
}

export async function dbRequest<T=unknown>(table:string, options:{
  method?:string; account?:SessionAccount|null; query?:string; body?:unknown; prefer?:string
} = {}):Promise<T> {
  if (!URL || !KEY) throw new Error('Database is not configured. Check the VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.')
  const response = await fetch(`${URL}/rest/v1/${table}${options.query ? `?${options.query}` : ''}`, {
    method: options.method || 'GET',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${token(options.account)}`,
      'Content-Type':'application/json',
      ...(options.prefer ? {Prefer:options.prefer} : {})
    },
    ...(options.body === undefined ? {} : {body:JSON.stringify(options.body)})
  })
  const text = await response.text()
  const data = text ? (()=>{try{return JSON.parse(text)}catch{return text}})() : null
  if (!response.ok) {
    const message = typeof data === 'object' && data ? ((data as any).message || (data as any).details || (data as any).hint) : ''
    throw new Error(message || `Database request failed (${response.status}).`)
  }
  return data as T
}

export const isDbConfigured = () => Boolean(URL && KEY)
