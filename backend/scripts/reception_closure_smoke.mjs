// Real local demo HTTP validation. No passwords, bearer tokens or response bodies are logged.
import { loadEnvFile } from 'node:process';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');loadEnvFile(resolve(root,'frontend/.env.local'));
const origin=process.env.GYMFLOW_API_URL;if(origin!=='http://127.0.0.1:5080')throw Error('Local API only.');
const f=JSON.parse(await readFile(resolve(root,'backend/artifacts/reception-fixture.json'),'utf8'));const checks=[];let token,shift;
const check=(name,pass)=>{checks.push({name,pass:!!pass});if(!pass)throw Error(name);};
async function http(path,method='GET',body,status=200){const r=await fetch(origin+'/api/v1/'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});check(method+' '+path.split('?')[0]+' '+status,r.status===status);return r.status===204||r.status>=400?null:r.json();}
async function login(role){return (await http('auth/login','POST',{email:process.env['GYMFLOW_E2E_'+role+'_EMAIL'],password:process.env['GYMFLOW_E2E_'+role+'_PASSWORD'],organizationPublicId:process.env.NEXT_PUBLIC_ORGANIZATION_ID,deviceName:'Closure smoke'})).accessToken;}
try{
 const reception=await login('RECEPTION'),admin=await login('ADMIN');token=reception;
 const context=await http('reception/context');await http('shift-handoffs/employees');
 const handoff={requestId:randomUUID(),branchId:f.branchId,toEmployeeId:null,cashShiftId:null,notes:'Entrega de prueba funcional',pendingItems:'Revisar respuesta de atención.'};
 const h=await http('shift-handoffs','POST',handoff);check('Cash linkage optional',h.cashShiftId===null);
 check('Handoff replay',h.shiftHandoffId===(await http('shift-handoffs','POST',handoff)).shiftHandoffId);
 const ack=await http(`shift-handoffs/${h.shiftHandoffId}/acknowledge`,'POST',{rowVersion:h.rowVersion});check('Acknowledged recipient',ack.status==='ACKNOWLEDGED'&&ack.toEmployeeId===context.employeeId);
 await http(`shift-handoffs/${h.shiftHandoffId}/cancel`,'POST',{rowVersion:h.rowVersion},409);
 const cancel=await http('shift-handoffs','POST',{...handoff,requestId:randomUUID()});await http(`shift-handoffs/${cancel.shiftHandoffId}/cancel`,'POST',{rowVersion:cancel.rowVersion});
 const m=await http('members','POST',{firstName:'Sofía',lastName:'Ugarte',homeBranchId:f.branchId},201);
 const checkin={memberId:m.memberId,branchId:f.branchId,accessMethod:'MANUAL',deviceId:null};check('Blocked before authorization',!(await http('access/check-in','POST',checkin)).allowed);
 const exception=await http('access/exceptions','POST',{requestId:randomUUID(),memberId:m.memberId,reason:'Revisión de alta de socio ficticio',validFromUtc:new Date(Date.now()-60000).toISOString(),validToUtc:new Date(Date.now()+3600000).toISOString()});
 await http(`access/exceptions/${exception.accessExceptionId}/review`,'POST',{status:'APPROVED'},403);
 const before=(await http('access/events?memberId='+m.memberId)).total;
 token=admin;await http(`access/exceptions/${exception.accessExceptionId}/review`,'POST',{status:'APPROVED'},204);token=reception;
 check('Approval does not create attendance',(await http('access/events?memberId='+m.memberId)).total===before);
 check('Real check-in creates allowed attendance',(await http('access/check-in','POST',checkin)).allowed);
 const incident={requestId:randomUUID(),memberId:m.memberId,category:'ACCESS',priority:'NORMAL',subject:'Seguimiento de acceso',description:'Se verificó la solicitud de acceso del socio ficticio.'};
 const ticket=await http('incidents','POST',incident);check('Incident replay',ticket.supportTicketId===(await http('incidents','POST',incident)).supportTicketId);
 const item=(await http('incidents')).items.find(t=>t.supportTicketId===ticket.supportTicketId);check('Incident member link',item.memberId===m.memberId);
 const message={requestId:randomUUID(),body:'Atención registrada y comunicada por canal interno.'};const sent=await http(`conversations/${item.conversationId}/messages`,'POST',message);check('Message replay',sent.messageId===(await http(`conversations/${item.conversationId}/messages`,'POST',message)).messageId);
 check('Description plus response',(await http(`conversations/${item.conversationId}/messages`)).total===2);
 token=admin;await http(`conversations/${item.conversationId}/messages`,'GET',null,404);token=reception;
 const opened=await http('cash-shifts/open','POST',{cashRegisterId:f.cashRegisterId,employeeId:context.employeeId,openingAmount:100,openingNotes:'Prueba de devolución.'},201);shift=opened.cashShiftId;
 const methods=(await http('payment-methods?pageSize=100')).items;const cash=methods.find(m=>m.isCash),yape=methods.find(m=>m.code==='YAPE');
 const sale=await http('store/sales','POST',{requestId:randomUUID(),branchId:f.branchId,memberId:m.memberId,cashShiftId:shift,currencyCode:'PEN',items:[{productPublicId:f.productPublicId,quantity:1,expectedUnitPrice:35}],splits:[{paymentMethodId:cash.paymentMethodId,amount:10},{paymentMethodId:yape.paymentMethodId,amount:25}]});
 const line=(await http('store/returns/lines?search='+sale.orderNumber)).items[0];
 const r=await http('store/returns','POST',{requestId:randomUUID(),orderItemId:line.orderItemId,quantity:1,reason:'Cambio de producto de prueba.'});
 await http(`store/returns/${r.productReturnId}/review`,'POST',{status:'APPROVED'},403);
 token=admin;await http(`store/returns/${r.productReturnId}/review`,'POST',{status:'APPROVED'},204);token=reception;
 const sources=await http(`store/returns/${r.productReturnId}/sources`);const refund={requestId:randomUUID(),cashShiftId:shift,splits:sources.map(s=>({paymentSplitId:s.paymentSplitId,amount:s.amount}))};
 const processed=await http(`store/returns/${r.productReturnId}/process`,'POST',refund);check('Return processed',processed.status==='PROCESSED');
 await http(`store/returns/${r.productReturnId}/process`,'POST',refund);
 const moves=(await http(`cash-shifts/${shift}/movements?pageSize=100`)).items;check('Only original cash returned',moves.filter(m=>m.movementType==='REFUND').reduce((s,m)=>s+m.amount,0)===10);
 check('Payment preserved refunded',(await http('payments/'+sale.payment.publicId)).payment.status==='REFUNDED');
 const hcash=await http('shift-handoffs','POST',{...handoff,requestId:randomUUID(),cashShiftId:shift});check('Handoff linked to cash',hcash.cashShiftId===shift);
 const closed=await http(`cash-shifts/${shift}/close`,'POST',{countedAmount:100,closingNotes:'Devolución conciliada.'});check('Cash reconciles',closed.differenceAmount===0);shift=null;
 for(const path of ['dashboard/summary','products/manage'])await http(path,'GET',null,403);
 await http('store/returns/9223372036854775806/sources','GET',null,404);
 await writeFile(resolve(root,'backend/artifacts/closure-live-fixture.json'),JSON.stringify({memberId:m.memberId,memberPublicId:m.publicId,exceptionId:exception.accessExceptionId,productReturnId:r.productReturnId},null,2));
}finally{
 if(shift&&token){const current=(await http('cash-shifts/me?status=OPEN&pageSize=100')).items.find(s=>s.cashShiftId===shift);if(current)await http(`cash-shifts/${shift}/close`,'POST',{countedAmount:current.expectedAmount,closingNotes:'Cierre de validación interrumpida.'});}
 await writeFile(resolve(root,'backend/artifacts/reception-closure-smoke.json'),JSON.stringify(checks,null,2));console.log(`${checks.filter(c=>c.pass).length}/${checks.length} closure HTTP checks passed.`);
}
