import type {Lot,Process} from './domain';
import type {DocumentVersion,Requirement} from './documents';
export const STATES='AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
export const CHECKS=[
 'Conferi os dados do projeto e dos proprietários.', 'Conferi as matrículas e os documentos do imóvel.',
 'Conferi os responsáveis, registros e documentos de responsabilidade técnica.', 'Conferi o modelo de prancha aplicável.',
 'Conferi títulos, numeração, escalas e legibilidade.', 'Incluí plantas de todos os pavimentos e cobertura.',
 'Conferi os cortes e fachadas exigidos.', 'Conferi áreas, cotas e quantidade de pavimentos.',
 'Conferi a correspondência dos arquivos à revisão informada.', 'Conferi os parâmetros e a restrição urbanística.',
 'Conferi que os arquivos representam a entrega que desejo submeter.',
];
export interface Owner {id:string;kind:'CPF'|'CNPJ';name:string;document:string;phone:string;email:string;street:string;number:string;neighborhood:string;zip:string;state:string;city:string;active:boolean}
export interface Property {id:string;lotId:string;registry:string;registration:string;block:string;lot:string;street:string;number:string;complement:string;active:boolean}
export interface Technician {id:string;name:string;document:string;council:'CAU'|'CREA';registration:string;discipline:'Arquitetônico'|'Estrutural';art:string;email:string;phone:string;active:boolean}
export interface Floor {id:string;area:string;base:string;top:string}
export interface Surface {id:string;name:string;area:string;factor:string;active:boolean}
export interface Roof {id:string;name:string;level:string;active:boolean}
export interface Room {id:string;floorId:string;name:string;area:string;category:string;active:boolean}
export interface Sheet {id:string;title:string;revision:string;cadRequired:boolean;active:boolean}
export interface Intake {organizationId?:string;schemaVersion:1;id:string;version:number;sourceProcessId?:string;updatedAt:string;title:string;kind:'Construção'|'Reforma'|'Regularização';owners:Owner[];properties:Property[];technicians:Technician[];landArea:string;declaredArea:string;floorCount:string;floors:Floor[];surfaces:Surface[];roofs:Roof[];hasTechnical:boolean;technicalBase:string;technicalTop:string;rooms:Room[];sheets:Sheet[];checks:boolean[];notApplicable?:Record<string,string>;declared:boolean;finalConfirmed:boolean;verifiedFiles:string[];justification:string;notes:string}
const uid=()=>crypto.randomUUID();
export const newOwner=():Owner=>({id:uid(),kind:'CPF',name:'',document:'',phone:'',email:'',street:'',number:'',neighborhood:'',zip:'',state:'',city:'',active:true});
export const newProperty=():Property=>({id:uid(),lotId:'',registry:'',registration:'',block:'',lot:'',street:'',number:'',complement:'',active:true});
export const newTechnician=():Technician=>({id:uid(),name:'',document:'',council:'CAU',registration:'',discipline:'Arquitetônico',art:'',email:'',phone:'',active:true});
export const newFloor=():Floor=>({id:uid(),area:'',base:'',top:''});
export const newSheet=():Sheet=>({id:uid(),title:'Nova prancha',revision:'R00',cadRequired:false,active:true});
export function newIntake(process?:Process,lot?:Lot):Intake{
 const owner=newOwner();if(lot)Object.assign(owner,lot.owner);
 const prop=newProperty();if(lot)Object.assign(prop,{lotId:lot.id,block:lot.block,lot:lot.number});
 const tech=newTechnician();if(process)Object.assign(tech,process.professional);
 return {schemaVersion:1,id:process?.id??uid(),version:0,sourceProcessId:process?.id,updatedAt:new Date().toISOString(),title:process?.title??'',kind:process?.kind??'Construção',owners:[owner],properties:[prop],technicians:[tech],landArea:lot?String(lot.area):'',declaredArea:'',floorCount:'1',floors:[newFloor()],surfaces:[],roofs:[],hasTechnical:false,technicalBase:'',technicalTop:'',rooms:[],sheets:[{...newSheet(),title:'Planta de situação / implantação'},{...newSheet(),title:'Projeto arquitetônico'}],checks:CHECKS.map(()=>false),notApplicable:{},declared:false,finalConfirmed:false,verifiedFiles:[],justification:'',notes:''};
}
export function invalidate(d:Intake):Intake{return {...d,checks:CHECKS.map(()=>false),declared:false,finalConfirmed:false};}
export function withFloorCount(d:Intake,value:string):Intake {const n=Number(value);const floors=[...d.floors];if(Number.isInteger(n)&&n>0&&n<=12)while(floors.length<n)floors.push(newFloor());return {...invalidate(d),floorCount:value,floors};}
export function activeFloors(d:Intake){const n=Number(d.floorCount);return Number.isInteger(n)&&n>0&&n<=12?d.floors.slice(0,n):[];}
// Strict parsing: absence is not zero, and invalid text is not partially parsed.
export function decimal(raw:string):number|null{if(!/^-?\d+(?:[.,]\d{1,2})?$/.test(raw.trim()))return null;const n=Number(raw.replace(',','.'));return Number.isFinite(n)?n:null;}
export function validDocument(value:string){const s=value.replace(/[.\/\-\s]/g,'');if(!/^\d{11}$|^\d{14}$/.test(s)||/^(\d)\1+$/.test(s))return false;const a=[...s].map(Number);if(a.length===11){for(let n=9;n<11;n++){const v=(a.slice(0,n).reduce((sum,x,i)=>sum+x*(n+1-i),0)*10)%11;if((v===10?0:v)!==a[n])return false;}}else{for(let n=12;n<14;n++){const sum=a.slice(0,n).reduce((sum,x,i)=>sum+x*((n-1-i)%8+2),0);const v=sum%11; if((v<2?0:11-v)!==a[n])return false;}}return true;}
export const DEMO_RULES={id:'demonstracao-v1',official:false,permeability:20,coefficient:1,floorPct:[60,60,30] as (number|null)[],groundBaseMax:0.8,heightMax:10};
export type Result={label:string;section:string;status:'ok'|'bad'|'missing'|'unconfigured';detail:string};
const fmt=(v:number)=>v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
export function calculate(d:Intake):Result[]{const out:Result[]=[];const land=decimal(d.landArea),total=decimal(d.declaredArea),floors=activeFloors(d);
 const add=(label:string,status:Result['status'],detail:string)=>out.push({label,section:'urban',status,detail});
 const upper=(label:string,value:number|null,limit:number|null,unit='m²')=>{if(value===null||limit===null)add(label,'missing','Preencha os dados para calcular.');else if(value<0)add(label,'bad','O valor não pode ser negativo.');else add(label,Math.round(value*100)<=Math.round(limit*100)?'ok':'bad',`${fmt(value)} ${unit} informados · limite demonstrativo ${fmt(limit)} ${unit}`);};
 upper('Área total computável',total,land!==null&&land>0?land*DEMO_RULES.coefficient:null);
 floors.forEach((f,i)=>{const pct=DEMO_RULES.floorPct[i];if(pct==null)add(`Área do pavimento ${i}`,'unconfigured','Não há limite cadastrado para este nível.');else upper(i===0?'Área do térreo':`Área do ${i}º pavimento`,decimal(f.area),land!==null&&land>0?land*pct/100:null);});
 if(floors.length&&floors.every(f=>decimal(f.area)!==null)&&total!==null){const sum=floors.reduce((s,f)=>s+Math.round(decimal(f.area)!*100),0);add('Soma dos pavimentos',Math.abs(sum-Math.round(total*100))<=5?'ok':'bad',`${fmt(sum/100)} m² somados · ${fmt(total)} m² declarados · tolerância demonstrativa 0,05 m²`);}else add('Soma dos pavimentos','missing','Complete todas as áreas e o total declarado.');
 const surfaces=d.surfaces.filter(s=>s.active);if(land===null||land<=0||!surfaces.length||surfaces.some(s=>decimal(s.area)===null||decimal(s.area)!<0||!['1','0.5','0'].includes(s.factor)))add('Permeabilidade','missing','Cadastre superfícies e áreas válidas.');else{const effective=surfaces.reduce((s,x)=>s+decimal(x.area)!*Number(x.factor),0);const nominal=surfaces.reduce((s,x)=>s+decimal(x.area)!,0);add('Permeabilidade efetiva',Math.round(effective*100)>=Math.round(land*20)?'ok':'bad',`${fmt(effective)} m² efetivos · mínimo demonstrativo ${fmt(land*.2)} m²`);upper('Superfícies cadastradas',nominal,land);}
 upper('Base do térreo',floors[0]?decimal(floors[0].base):null,DEMO_RULES.groundBaseMax,'m');
 floors.forEach((f,i)=>{const b=decimal(f.base),t=decimal(f.top);add(`Cotas do nível ${i}`,b===null||t===null?'missing':t>b?'ok':'bad',b===null||t===null?'Preencha base e topo.':t>b?`${fmt(t-b)} m entre cotas.`:'O topo deve estar acima da base.');if(i>0){const prev=decimal(floors[i-1].top);if(b!==null&&prev!==null&&Math.round(b*100)<Math.round(prev*100))add(`Sequência do nível ${i}`,'bad','A base está abaixo do topo do pavimento anterior.');}});
 const roofs=d.roofs.filter(r=>r.active);const tops=[...floors.map(f=>decimal(f.top)),...roofs.map(r=>decimal(r.level))];
 if(tops.length&&tops.every(v=>v!==null)){const maximum=Math.max(...tops as number[]);upper('Altura sem volume técnico',maximum,DEMO_RULES.heightMax,'m');if(d.hasTechnical){const b=decimal(d.technicalBase),t=decimal(d.technicalTop);add('Volume técnico',b===null||t===null?'missing':b>=maximum&&t>b?'ok':'bad','Base técnica deve estar no nível ou acima das coberturas/pavimentos; topo deve superar a base.');upper('Base da área técnica',b,DEMO_RULES.heightMax,'m');}}else add('Altura','missing','Complete as cotas antes de calcular.');
 for(const room of d.rooms.filter(r=>r.active))out.push({label:`Ambiente: ${room.name||'sem nome'}`,section:'urban',status:'unconfigured',detail:'Critério dimensional não cadastrado; exige avaliação técnica.'});
 add('Limite de pavimentos do lote','unconfigured','Classificação oficial do lote ainda não cadastrada. O limite operacional de 12 linhas não é autorização urbanística.');
 return out;
}
export interface IntakeRequirement extends Requirement {section:string;format:'document'|'pdf'|'cad'}
export function intakeRequirements(d:Intake):IntakeRequirement[]{return [
 ...d.owners.filter(x=>x.active).map(x=>({id:`owner:${x.id}`,title:`${x.kind==='CPF'?'Identidade':'Documentação da pessoa jurídica'} · ${x.name||'Proprietário'}`,description:x.kind==='CPF'?'RG/CNH legível.':'Conjunto documental da PJ a conferir pela equipe.',section:'owners',format:'document' as const})),
 ...d.properties.filter(x=>x.active).flatMap(x=>['Matrícula','IPTU / BIC'].map((title,i)=>({id:`property:${x.id}:${i}`,title:`${title} · Q${x.block} L${x.lot}`,description:'Documento vinculado a este imóvel.',section:'properties',format:'document' as const}))),
 {id:'urban-restriction',title:'Restrição urbanística / viabilidade',description:'Documento aplicável ao lote; exigência preliminar.',section:'properties',format:'document'},
 ...d.technicians.filter(x=>x.active).map(x=>({id:`tech:${x.id}`,title:`ART / RRT · ${x.name||'Responsável'}`,description:x.discipline,section:'technicians',format:'document' as const})),
 ...d.sheets.filter(x=>x.active).flatMap(x=>[{id:`sheet:${x.id}:${encodeURIComponent(x.revision)}:pdf`,title:`${x.title} · ${x.revision} · PDF`,description:'Arquivo de leitura para análise.',section:'files',format:'pdf' as const},...x.cadRequired?[{id:`sheet:${x.id}:${encodeURIComponent(x.revision)}:cad`,title:`${x.title} · ${x.revision} · CAD`,description:'DWG ou DXF da mesma revisão.',section:'files',format:'cad' as const}]:[]]),
 ];}
export type Issue={section:string;message:string};
export function validateIntake(d:Intake,files:Omit<DocumentVersion,'blob'>[]):Issue[]{const errors:Issue[]=[];const add=(section:string,message:string)=>errors.push({section,message});const email=(s:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);const phone=(s:string)=>/^\d{10,13}$/.test(s.replace(/\D/g,''));
 if(!d.title.trim())add('owners','Informe o nome do projeto.');
 if(!d.owners.some(x=>x.active))add('owners','Inclua ao menos um proprietário.');
 d.owners.filter(x=>x.active).forEach((x,i)=>{if(![x.name,x.street,x.number,x.neighborhood,x.city].every(s=>s.trim())||!STATES.includes(x.state)||!/^\d{8}$/.test(x.zip.replace(/\D/g,'')))add('owners',`Proprietário ${i+1}: complete nome e endereço válido.`);if(!validDocument(x.document)||x.document.replace(/\D/g,'').length!==(x.kind==='CPF'?11:14))add('owners',`Proprietário ${i+1}: confira o ${x.kind}.`);if(!email(x.email)||!phone(x.phone))add('owners',`Proprietário ${i+1}: confira e-mail e telefone.`);});
 const props=d.properties.filter(x=>x.active);if(!props.length)add('properties','Inclua ao menos um imóvel.');props.forEach((x,i)=>{if(![x.registry,x.registration,x.block,x.lot,x.street].every(s=>s.trim()))add('properties',`Imóvel ${i+1}: complete matrícula, inscrição, quadra, lote e logradouro.`);});if(new Set(props.map(x=>x.registry.trim()).filter(Boolean)).size!==props.filter(x=>x.registry.trim()).length)add('properties','Há matrículas repetidas.');
 const techs=d.technicians.filter(x=>x.active);if(!techs.length)add('technicians','Inclua um responsável técnico.');techs.forEach((x,i)=>{if(![x.name,x.registration,x.art].every(s=>s.trim())||!validDocument(x.document)||!email(x.email)||!phone(x.phone))add('technicians',`Responsável ${i+1}: complete identificação, registro, ART/RRT e contatos válidos.`);});
 const positive=(s:string)=>decimal(s)!==null&&decimal(s)!>0;const nonnegative=(s:string)=>decimal(s)!==null&&decimal(s)!>=0;
 if(!positive(d.landArea)||!positive(d.declaredArea))add('urban','Terreno e área total devem ser maiores que zero, com até duas casas decimais.');
 if(!activeFloors(d).length)add('urban','Informe uma quantidade inteira entre 1 e 12 pavimentos.');activeFloors(d).forEach((f,i)=>{if(!positive(f.area)||!nonnegative(f.base)||!nonnegative(f.top))add('urban',`Complete áreas e cotas válidas do nível ${i}.`);});
 if(!d.surfaces.some(x=>x.active))add('urban','Cadastre as superfícies permeáveis.');d.surfaces.filter(x=>x.active).forEach(x=>{if(!x.name.trim()||!nonnegative(x.area)||!['1','0.5','0'].includes(x.factor))add('urban','Complete nome, área e fator de cada superfície.');});
 if(!d.roofs.some(x=>x.active))add('urban','Cadastre ao menos uma cobertura.');d.roofs.filter(x=>x.active).forEach(x=>{if(!x.name.trim()||!nonnegative(x.level))add('urban','Complete nome e cota de cada cobertura.');});
 if(d.hasTechnical&&(!nonnegative(d.technicalBase)||!nonnegative(d.technicalTop)))add('urban','Complete as cotas da área técnica.');
 d.rooms.filter(x=>x.active).forEach(x=>{if(!x.name.trim()||!positive(x.area)||!activeFloors(d).some(f=>f.id===x.floorId)||!x.category)add('urban','Revise nome, área, pavimento e categoria dos ambientes.');});
 if(!d.sheets.some(x=>x.active))add('files','Inclua ao menos uma prancha.');d.sheets.filter(x=>x.active).forEach(x=>{if(!x.title.trim()||!x.revision.trim())add('files','Cada prancha precisa de título e revisão.');});
 intakeRequirements(d).forEach(r=>{if(!files.some(v=>v.processId===d.id&&v.requirementId===r.id))add(r.section,`Anexe: ${r.title}.`);});
 if(d.checks.length!==CHECKS.length||!d.checks.every((x,i)=>x||Boolean(d.notApplicable?.[i]?.trim()))||!d.declared)add('checklist','Conclua a autoconferência e a declaração.');
 const currentFiles=intakeRequirements(d).map(r=>files.filter(v=>v.processId===d.id&&v.requirementId===r.id).sort((a,b)=>b.number-a.number)[0]?.id??'').sort();
 if(d.declared&&JSON.stringify(currentFiles)!==JSON.stringify([...d.verifiedFiles].sort()))add('checklist','Os arquivos mudaram. Renove a declaração de conferência.');
 if(!d.finalConfirmed)add('review','Confirme os arquivos e dados da entrega.');
 if(calculate(d).some(r=>r.status!=='ok')&&!d.justification.trim())add('review','Registre a justificativa para divergências ou regras não cadastradas.');

 // Intrinsic inconsistencies cannot be waived by a free-text justification.
 for(const r of calculate(d))if(r.status==='bad'&&(r.label==='Soma dos pavimentos'||r.label==='Superfícies cadastradas'||r.label==='Volume técnico'||r.label.startsWith('Cotas do nível')||r.label.startsWith('Sequência do nível')))add('urban',r.label+': '+r.detail);
 const normalize=(v:string)=>v.replace(/[.\/\-\s]/g,'').toUpperCase();
 const owners=d.owners.filter(x=>x.active);if(new Set(owners.map(x=>normalize(x.document))).size!==owners.length)add('owners','Há proprietários com o mesmo documento.');
 const keys=props.map(x=>x.lotId||normalize(x.block)+'/'+normalize(x.lot));if(new Set(keys).size!==keys.length)add('properties','O mesmo lote foi incluído mais de uma vez.');
 const techKeys=techs.map(x=>normalize(x.document)+':'+x.discipline);if(new Set(techKeys).size!==techKeys.length)add('technicians','Responsável repetido para a mesma disciplina.');
 for(const f of activeFloors(d)){const rooms=d.rooms.filter(r=>r.active&&r.floorId===f.id);if(decimal(f.area)!==null&&rooms.every(r=>decimal(r.area)!==null)&&rooms.reduce((sum,r)=>sum+Math.round(decimal(r.area)!*100),0)>Math.round(decimal(f.area)!*100))add('urban','A soma das áreas dos ambientes supera a área do pavimento.');}
 for(const r of intakeRequirements(d)){const latest=files.filter(v=>v.processId===d.id&&v.requirementId===r.id).sort((a,b)=>b.number-a.number)[0];if(latest){const allowed=r.format==='pdf'?['application/pdf']:r.format==='cad'?['application/acad','image/vnd.dxf']:['application/pdf','image/png','image/jpeg'];if(!allowed.includes(latest.type)||latest.size<=0||latest.size>20*1024*1024)add(r.section,'Arquivo incompatível com a exigência: '+r.title);}}
 return errors;
}
