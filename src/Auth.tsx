import {useEffect,useState} from 'react'
import type {FormEvent} from 'react'

type Account = { id:string; email:string; name:string; access_token?:string; refresh_token?:string }
type Props = { mode:'login'|'signup'; account:Account|null; setAccount:(a:Account|null)=>void }

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

function recoveryParams(){
  const rawHash=location.hash.startsWith('#')?location.hash.slice(1):location.hash
  const hashParams=new URLSearchParams(rawHash.startsWith('/')?rawHash.slice(1):rawHash)
  const queryParams=new URLSearchParams(location.search)
  return {
    type:hashParams.get('type')||queryParams.get('type')||'',
    accessToken:hashParams.get('access_token')||'',
    tokenHash:queryParams.get('token_hash')||hashParams.get('token_hash')||'',
    code:queryParams.get('code')||''
  }
}

export default function AuthPage({mode:initialMode,account,setAccount}:Props){
  const [mode,setMode]=useState<'login'|'signup'>(initialMode)
  const [name,setName]=useState('')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [confirmPassword,setConfirmPassword]=useState('')
  const [country,setCountry]=useState('Nigeria')
  const [city,setCity]=useState('Lagos')
  const [busy,setBusy]=useState(false)
  const [notice,setNotice]=useState('')
  const [error,setError]=useState('')
  const [recovery,setRecovery]=useState(()=>recoveryParams().type==='recovery'||Boolean(recoveryParams().accessToken)||Boolean(recoveryParams().tokenHash))
  const [recoveryToken,setRecoveryToken]=useState(()=>recoveryParams().accessToken)
  const configured=Boolean(SUPABASE_URL&&SUPABASE_KEY)

  useEffect(()=>{
    const sync=()=>{
      const p=recoveryParams()
      if(p.type==='recovery'||p.accessToken||p.tokenHash){
        setRecovery(true)
        if(p.accessToken)setRecoveryToken(p.accessToken)
      }
    }
    window.addEventListener('hashchange',sync)
    sync()
    return()=>window.removeEventListener('hashchange',sync)
  },[])

  const submit=async(e:FormEvent)=>{
    e.preventDefault();setError('');setNotice('')
    if(recovery){await updatePassword(e);return}
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
      const redirectTo=location.origin
      const r=await fetch(SUPABASE_URL+'/auth/v1/recover?redirect_to='+encodeURIComponent(redirectTo),{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},body:JSON.stringify({email,gotrue_meta_security:{}})})
      const d=await r.json().catch(()=>({}))
      if(!r.ok)throw new Error(d.msg||d.message||'Could not send the reset email.')
      setNotice('If an account exists for this email, a password-reset link will be sent. Open the newest email to set a new password.')
    }catch(e){setError(e instanceof Error?e.message:'Could not send the reset email.')}
    finally{setBusy(false)}
  }

  async function updatePassword(e:FormEvent){
    e.preventDefault()
    setError('');setNotice('')
    if(!configured){setError('Password reset is unavailable because Supabase is not configured.');return}
    if(password.length<8){setError('Use a password with at least 8 characters.');return}
    if(password!==confirmPassword){setError('The passwords do not match.');return}
    setBusy(true)
    try{
      let token=recoveryToken
      const params=recoveryParams()
      if(!token&&params.tokenHash){
        const verified=await fetch(SUPABASE_URL+'/auth/v1/verify',{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},body:JSON.stringify({type:'recovery',token_hash:params.tokenHash})})
        const vd=await verified.json().catch(()=>({}))
        if(!verified.ok)throw new Error(vd.msg||vd.message||'This reset link is invalid or expired. Request a new one.')
        token=vd.access_token||''
      }
      if(!token)throw new Error(params.code?'This reset link uses a sign-in code that could not be verified. Request a new reset email and open it in the same browser.':'This reset link is missing its recovery token or has expired. Request a new reset email.')
      const response=await fetch(SUPABASE_URL+'/auth/v1/user',{method:'PUT',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':'Bearer '+token},body:JSON.stringify({password})})
      const data=await response.json().catch(()=>({}))
      if(!response.ok)throw new Error(data.msg||data.message||'Could not update your password. Request a new reset email and try again.')
      if(data.access_token)localStorage.setItem('pp:authSession',JSON.stringify(data))
      setRecovery(false)
      setPassword('');setConfirmPassword('')
      setNotice('Your password has been changed successfully. Go to Log in and sign in with your new password.')
      history.replaceState(null,'',location.pathname+location.search+'#/auth')
      location.hash='#/auth'
    }catch(e){setError(e instanceof Error?e.message:'Could not update your password.')}
    finally{setBusy(false)}
  }

  if(account&&!recovery)return <section className="card mx-auto max-w-lg space-y-4"><span className="chip">Signed in</span><h1 className="text-2xl font-extrabold">Welcome, {account.name}</h1><p className="text-sm text-mute">{account.email}</p><p className="text-sm text-mute">Your account is connected for this browser. Shared price and shop data will be enabled as the database features are connected.</p><button className="btn" onClick={()=>{localStorage.removeItem('pp:authSession');setAccount(null);setNotice('You have signed out.')}}>Sign out</button><a className="btn2 inline-block" href="#/">Continue to PricePulse</a></section>

  return <div className="mx-auto max-w-lg space-y-5">
    <section className="rounded-3xl bg-gradient-to-br from-deep to-brand p-6 text-white"><p className="text-sm font-semibold text-green-50">PRICEPULSE WORLD</p><h1 className="mt-2 text-3xl font-extrabold">{recovery?'Choose a new password':mode==='signup'?'Create your account':'Welcome back'}</h1><p className="mt-2 text-sm text-green-50">{recovery?'Enter and confirm the new password for your account.':'Know the price before you buy. Compare real prices around you and worldwide.'}</p></section>
    <section className="card space-y-4">
      {!recovery&&<div className="grid grid-cols-2 gap-2 rounded-xl bg-soft p-1"><button type="button" className={mode==='signup'?'btn':'btn2'} onClick={()=>{setMode('signup');setError('');setNotice('')}}>Create account</button><button type="button" className={mode==='login'?'btn':'btn2'} onClick={()=>{setMode('login');setError('');setNotice('')}}>I already have an account</button></div>}
      <form className="space-y-3" onSubmit={submit}>
        {!recovery&&mode==='signup'&&<><label className="block text-sm font-medium">Full name<input autoComplete="name" required className="inp mt-1" value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name"/></label><div className="grid grid-cols-2 gap-3"><label className="block text-sm font-medium">Country<input autoComplete="country-name" required className="inp mt-1" value={country} onChange={e=>setCountry(e.target.value)}/></label><label className="block text-sm font-medium">City<input autoComplete="address-level2" required className="inp mt-1" value={city} onChange={e=>setCity(e.target.value)}/></label></div></>}
        {!recovery&&<label className="block text-sm font-medium">Email address<input type="email" autoComplete="email" required className="inp mt-1" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>}
        <label className="block text-sm font-medium">{recovery?'New password':'Password'}<input type="password" autoComplete={recovery?'new-password':mode==='signup'?'new-password':'current-password'} minLength={8} required className="inp mt-1" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/></label>
        {recovery&&<label className="block text-sm font-medium">Confirm new password<input type="password" autoComplete="new-password" minLength={8} required className="inp mt-1" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Enter the new password again"/></label>}
        {!recovery&&mode==='login'&&<button type="button" disabled={busy} onClick={resetPassword} className="text-sm font-semibold text-brand underline">Forgot password?</button>}
        {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {notice&&<p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
        <button disabled={busy} type="submit" className="btn w-full">{busy?'Please wait…':recovery?'Save new password':mode==='signup'?'Create account':'Log in'}</button>
      </form>
      {!recovery&&<p className="text-center text-sm text-mute">{mode==='signup'?'Already have an account?':'New to PricePulse World?'} <button className="font-semibold text-brand underline" onClick={()=>{setMode(mode==='signup'?'login':'signup');setError('');setNotice('')}}>{mode==='signup'?'Log in':'Sign up'}</button></p>}
      {!configured&&<p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Account backend not configured yet. Real authentication will activate after the Supabase project URL and public anon key are added to the hosting build variables.</p>}
    </section>
    <p className="text-center text-sm text-mute"><a className="font-semibold text-brand underline" href="#/auth">Return to log in</a> · <a className="font-semibold text-brand underline" href="#/">Continue as guest</a></p>
  </div>
}
