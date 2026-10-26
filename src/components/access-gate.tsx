'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowRight, Building2, CheckCircle2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { createSupabaseBrowserClient, dataMode, supabaseConfigured } from '@/lib/supabase';
import { listWorkspaces, loadRemote, saveRemote, type Workspace } from '@/lib/remote-repository';
import type { PortalData } from '@/lib/domain';
import Portal from '@/components/portal';

export default function AccessGate({accessPage=false}:{accessPage?:boolean}) {
  const [session,setSession]=useState<Session|null>(null);
  const [checking,setChecking]=useState(true);
  const [email,setEmail]=useState('');
  const [sending,setSending]=useState(false);
  const [sent,setSent]=useState(false);
  const [error,setError]=useState('');
  const [workspaces,setWorkspaces]=useState<Workspace[]>([]);
  const [workspace,setWorkspace]=useState<Workspace|null>(null);
  const [data,setData]=useState<PortalData|null>(null);
  const [loading,setLoading]=useState(false);
  const generation=useRef(0);
  const remote=dataMode==='supabase';
  useEffect(()=>{
    if(!remote||!supabaseConfigured){setChecking(false);return;}
    let live=true;
    const client=createSupabaseBrowserClient();
    const {data:{subscription}}=client.auth.onAuthStateChange((_event,next)=>{
      if(!live)return;
      setSession(next);setChecking(false);
      if(!next){generation.current++;setData(null);setWorkspace(null);setWorkspaces([]);}
    });
    client.auth.getSession().then(({data,error})=>{if(live){setSession(data.session);setChecking(false);if(error)setError('Não foi possível verificar sua sessão. Tente entrar novamente.');}});
    return()=>{live=false;subscription.unsubscribe();};
  },[remote]);
  useEffect(()=>{
    if(!session?.user.id)return;
    const token=++generation.current;
    setLoading(true);setError('');
    listWorkspaces(createSupabaseBrowserClient()).then(async rows=>{
      if(token!==generation.current)return;
      setWorkspaces(rows);
      if(rows.length===1) {
        const loaded=await loadRemote(createSupabaseBrowserClient(),rows[0]);
        if(token!==generation.current)return;
        setWorkspace(rows[0]);setData(loaded);
      }
    }).catch(e=>{if(token===generation.current)setError((e as Error).message);})
      .finally(()=>{if(token===generation.current)setLoading(false);});
  },[session?.user.id]);
  async function choose(w:Workspace) {
    const token=++generation.current;
    setLoading(true);setError('');setData(null);setWorkspace(null);
    try{const next=await loadRemote(createSupabaseBrowserClient(),w);if(token===generation.current){setWorkspace(w);setData(next);}}
    catch(e){if(token===generation.current)setError((e as Error).message);}
    finally{if(token===generation.current)setLoading(false);}
  }
  async function signout() {
    generation.current++;setData(null);setWorkspace(null);
    const {error}=await createSupabaseBrowserClient().auth.signOut({scope:'local'});
    if(error){setError('Não foi possível encerrar a sessão. Tente novamente.');return;}
    setSession(null);setWorkspaces([]);
  }
  async function sendLink(e:FormEvent) {
    e.preventDefault();if(!remote||!supabaseConfigured)return;
    setSending(true);setError('');setSent(false);
    try{
      const {error}=await createSupabaseBrowserClient().auth.signInWithOtp({
        email:email.trim(),options:{shouldCreateUser:false,emailRedirectTo:`${window.location.origin}/acesso`},
      });
      if(error)throw error;
      setSent(true);
    }catch{setError('Não foi possível enviar o link. Confira seu e-mail, o convite e tente novamente em alguns instantes.');}
    finally{setSending(false);}
  }
  if(!remote&&!accessPage) return <Portal/>;
  if(remote&&session&&data&&workspace) return <Portal key={`${session.user.id}:${workspace.id}`} remote={{
    initial:data,email:session.user.email??'Administrador',workspaceName:workspace.name,
    save:(before,after)=>saveRemote(createSupabaseBrowserClient(),workspace,before,after),
    reload:()=>loadRemote(createSupabaseBrowserClient(),workspace),logout:signout,
    switchWorkspace:()=>{setData(null);setWorkspace(null);},
  }}/>;
  return <main className="access-shell"><section className="access-story"><div className="access-brand"><Building2 size={32}/>GM BIM <small>Projetos & Soluções</small></div><div><span className="eyebrow">CADA ETAPA, NO MESMO LUGAR</span><h1>Projetos conectados.<br/>Histórias preservadas.</h1><p>Acompanhe os lotes, organize documentos e dê clareza ao próximo passo de cada processo.</p></div><div className="access-trust"><ShieldCheck size={19}/><span>Acesso vinculado ao seu empreendimento.</span></div></section><section className="access-card">
    {checking||loading?<><div className="round-icon"><LockKeyhole/></div><h2>Preparando seu acesso</h2><p>Verificando sua sessão e os empreendimentos disponíveis…</p></>:!remote||!supabaseConfigured?<><div className="round-icon"><SettingsIcon/></div><span className="eyebrow">INTEGRAÇÃO EM PREPARAÇÃO</span><h2>Seu portal está ganhando uma base segura.</h2><p>O modo Supabase ainda não está configurado neste ambiente. A demonstração permanece separada dos dados reais.</p><ol><li>Criar um projeto de desenvolvimento no Supabase.</li><li>Aplicar a migração e vincular o administrador.</li><li>Configurar URL, chave pública e modo Supabase.</li></ol>{!remote&&<a className="button primary" href="/">Explorar demonstração <ArrowRight size={17}/></a>}<small className="access-footnote">Nenhuma conta, e-mail ou dado remoto foi criado automaticamente.</small></>:session?<><div className="round-icon"><Building2/></div><h2>{workspaces.length?'Escolha seu empreendimento':'Nenhum empreendimento disponível'}</h2><p>{workspaces.length?'Acesse o espaço que deseja administrar.':'Sua conta está autenticada, mas ainda não possui um empreendimento com acesso administrativo. Solicite o vínculo ao responsável.'}</p><div className="workspace-options">{workspaces.map(w=><button key={w.id} onClick={()=>choose(w)}>{w.name}<ArrowRight size={17}/></button>)}</div><a className="button primary" href="/portal-cliente">Acessar projetos e documentos</a><button className="button secondary" onClick={signout}>Sair da conta</button></>:<><div className="round-icon"><LockKeyhole/></div><span className="eyebrow">BEM-VINDO AO SEU PORTAL</span><h2>Acesse seu empreendimento.</h2><p>Informe o e-mail autorizado. Enviaremos um link seguro para entrar, sem precisar de senha.</p><form onSubmit={sendLink}><label className="field"><span>E-mail de acesso</span><input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@empresa.com.br" disabled={sending}/></label><button className="button primary" disabled={sending}><Mail size={17}/>{sending?'Enviando…':'Receber link de acesso'}</button></form>{sent&&<div className="info-box" role="status"><CheckCircle2 size={18}/><p>Se este e-mail estiver autorizado, você receberá um link. Confira também a pasta de spam.</p></div>}<small className="access-footnote">O acesso depende de convite e vínculo administrativo. O envio não cria uma conta automaticamente.</small></>}
    {error&&<p role="alert" className="form-error">{error}</p>}
  </section></main>;
}
function SettingsIcon(){return <ShieldCheck size={25}/>;}
