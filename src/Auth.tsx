import {useState} from 'react'
import type {FormEvent} from 'react'

type Account = { id:string; email:string; name:string; access_token?:string; refresh_token?:string }
type Props = { mode:'login'|'signup'; account:Account|null; setAccount:(a:Account|null)=>void }

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export default function AuthPage({mode:initialMode,account,setAccount}:Props){
  const [mode,setMode]=useState<'login'|'signup'>(initialMode)
  const [name,setName]=useState('')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [country,setCountry]=useState('Nigeria')
  const [city,setCity]=useState('Lagos')
  const [busy,setBusy]=useState(false)
  const [notice,setNotice]=useState('')
  const [error,setError]=useState('')
  const configured=Boolean(SUPABASE_URL&&SUPABASE_KEY)

  const submit=async(e:FormEvent)=>{
    e.preventDefault();setError('');setNotice('')
    if(!configured){setError('Account services are not connected yet. Supabase setup is required before real sign-up or login can work. Browsing as a guest is still available.');return}
    if(password.length<8){setError('Use a password with at least 8 characters.');return}
    setBusy(true)
    try{
      const signup=mode==='signup'
      const response=await fetch(SUPABASE_URL+(signup?'/auth/v1/signup':'/auth/v1/token?grant_type=password'),{
        method:'POST',
        headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},
        body:JSON.stringify(signup?{email,password,data:{full_name:name.trim(),country,city}}:{email,password})
      })
      const data=await response.json()
      if(!response.ok)throw new Error(data.msg||data.message||data.error_description||'Unable to complete your request. Check your details and try again.')
      if(!data.access_token){
        setNotice('Your account request was received. Check your email for a verification link, then return here to log in.')
        setMode('login');setPassword('');return
      }
      const user=data.user||{}
      const next:Account={id:user.id,email:user.email||email,name:user.user_metadata?.full_name||name||email,access_token:data.access_token,refresh_token:data.refresh_token}
      localStorage.setItem('pp:authSession',JSON.stringify(data))
      setAccount(next)
      location.hash='#/'
    }catch(e){setError(e instanceof Error?e.message:'Something went wrong. Please try again.')}
    finally{setBusy(false)}
  }

  const resetPassword=async()=>{
    setError('');setNotice('')
    if(!configured){setError('Password reset is unavailable until Supabase is connected.');return}
    if(!email.trim()){setError('Enter your email address first.');return}
    setBusy(true)
    try{
      const r=await fetch(SUPABASE_URL+'/auth/v1/recover',{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},body:JSON.stringify({email,gotrue_meta_security:{}})})
      const d=await r.json().catch(()=>({}))
      if(!r.ok)throw new Error(d.msg||d.message||'Could not send the reset email.')
      setNotice('If an account exists for this email, a password-reset link will be sent.')
    }catch(e){setError(e instanceof Error?e.message:'Could not send the reset email.')}
    finally{setBusy(false)}
  }

  if(account)return <section className="card mx-auto max-w-lg space-y-4"><span className="chip">Signed in</span><h1 className="text-2xl font-extrabold">Welcome, {account.name}</h1><p className="text-sm text-mute">{account.email}</p><p className="text-sm text-mute">Your account is connected for this browser. Shared price and shop data will be enabled as the database features are connected.</p><button className="btn" onClick={()=>{localStorage.removeItem('pp:authSession');setAccount(null);setNotice('You have signed out.')}}>Sign out</button><a className="btn2 inline-block" href="#/">Continue to PricePulse</a></section>

  return <div className="mx-auto max-w-lg space-y-5">
    <section className="rounded-3xl bg-gradient-to-br from-deep to-brand p-6 text-white"><p className="text-sm font-semibold text-green-50">PRICEPULSE WORLD</p><h1 className="mt-2 text-3xl font-extrabold">{mode==='signup'?'Create your account':'Welcome back'}</h1><p className="mt-2 text-sm text-green-50">Know the price before you buy. Compare real prices around you and worldwide.</p></section>
    <section className="card space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-soft p-1"><button type="button" className={mode==='signup'?'btn':'btn2'} onClick={()=>{setMode('signup');setError('');setNotice('')}}>Create account</button><button type="button" className={mode==='login'?'btn':'btn2'} onClick={()=>{setMode('login');setError('');setNotice('')}}>I already have an account</button></div>
      <form className="space-y-3" onSubmit={submit}>
        {mode==='signup'&&<><label className="block text-sm font-medium">Full name<input autoComplete="name" required className="inp mt-1" value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name"/></label><div className="grid grid-cols-2 gap-3"><label className="block text-sm font-medium">Country<input autoComplete="country-name" required className="inp mt-1" value={country} onChange={e=>setCountry(e.target.value)}/></label><label className="block text-sm font-medium">City<input autoComplete="address-level2" required className="inp mt-1" value={city} onChange={e=>setCity(e.target.value)}/></label></div></>}
        <label className="block text-sm font-medium">Email address<input type="email" autoComplete="email" required className="inp mt-1" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
        <label className="block text-sm font-medium">Password<input type="password" autoComplete={mode==='signup'?'new-password':'current-password'} minLength={8} required className="inp mt-1" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/></label>
        {mode==='login'&&<button type="button" disabled={busy} onClick={resetPassword} className="text-sm font-semibold text-brand underline">Forgot password?</button>}
        {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {notice&&<p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
        <button disabled={busy} type="submit" className="btn w-full">{busy?'Please wait…':mode==='signup'?'Create account':'Log in'}</button>
      </form>
      <p className="text-center text-sm text-mute">{mode==='signup'?'Already have an account?':'New to PricePulse World?'} <button className="font-semibold text-brand underline" onClick={()=>{setMode(mode==='signup'?'login':'signup');setError('');setNotice('')}}>{mode==='signup'?'Log in':'Sign up'}</button></p>
      {!configured&&<p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Account backend not configured yet. Real authentication will activate after the Supabase project URL and public anon key are added to Netlify.</p>}
    </section>
    <p className="text-center text-sm text-mute">Just looking around? <a className="font-semibold text-brand underline" href="#/">Continue as guest</a></p>
  </div>
}
