// Real local HTTP contracts; fictitious demo writes only. Never logs credentials.
import { loadEnvFile } from 'node:process';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
loadEnvFile(resolve(root,'frontend/.env.local'));
const origin=process.env.GYMFLOW_API_URL;
if(origin!=='http://127.0.0.1:5080') throw Error('Local API only.');
const fixture=JSON.parse((await readFile(resolve(root,'backend/artifacts/reception-fixture.json'),'utf8')).replace(/^\uFEFF/,''));
const checks=[];
let token,shift;
const check=(name,pass)=>{checks.push({name,pass:!!pass});if(!pass)throw Error('Failed: '+name);};
async function http(path,method='GET',body,status=200){
 const r=await fetch(origin+'/api/v1/'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
 check(method+' '+path.split('?')[0]+' -> '+status,r.status===status);
 return r.status===204||r.status>=400?null:r.json();
}
const split=(method,amount)=>({paymentMethodId:method.paymentMethodId,amount,externalReference:null,providerTransactionId:null});
try{
 const session=await http('auth/login','POST',{email:process.env.GYMFLOW_E2E_RECEPTION_EMAIL,password:process.env.GYMFLOW_E2E_RECEPTION_PASSWORD,organizationPublicId:process.env.NEXT_PUBLIC_ORGANIZATION_ID,deviceName:'Local Reception smoke'});
 token=session.accessToken;
 const renewed=await http('auth/refresh','POST',{refreshToken:session.refreshToken});token=renewed.accessToken;
 check('Refresh rotates token',renewed.refreshToken!==session.refreshToken);
 for(const path of ['dashboard/summary','products/manage'])await http(path,'GET',null,403);
 await http('plans','POST',{},403);
 await http('store/sales','DELETE',null,405);
 const context=await http('reception/context');check('Linked Reception employee',context.employeeId>0);
 const methods=(await http('payment-methods?pageSize=100')).items;
 const cash=methods.find(x=>x.isCash),yape=methods.find(x=>x.code==='YAPE'),card=methods.find(x=>x.code==='CARD');
 check('Cash, Yape and card methods available',cash&&yape&&card);
 const member=await http('members','POST',{firstName:'Mariana',lastName:'Valverde',homeBranchId:fixture.branchId},201);
 check('MemberId exposed',member.memberId>0);
 Object.assign(fixture,{memberId:member.memberId,memberPublicId:member.publicId,memberName:'Mariana Valverde'});
 const detail=await http('members/'+member.publicId);check('Optimistic contact version exposed',!!detail.rowVersion);
 const edit={firstName:detail.firstName,lastName:detail.lastName,phone:null,email:null,rowVersion:detail.rowVersion};
 await http('members/'+member.publicId,'PUT',edit,204);await http('members/'+member.publicId,'PUT',edit,409);
 await http('receivables?memberId=9223372036854775806','GET',null,404);
 await http('cash-shifts/9223372036854775806/movements','GET',null,404);
 const plans=(await http('plans?status=ACTIVE&pageSize=100')).items;
 const plan=plans.find(p=>p.terms?.currencyCode==='PEN'&&p.terms.price>=60);
 check('Active priced demo plan',!!plan);
 const membership=await http('memberships','POST',{memberId:member.memberId,planVersionId:plan.planVersionId,startDate:new Date().toISOString().slice(0,10),homeBranchId:fixture.branchId,origin:'RECEPTION',requestId:randomUUID()},201);
 const debt=(await http('receivables?memberId='+member.memberId)).items.find(x=>x.receivableId===membership.receivableId);
 check('Membership produces matching debt',debt.balanceAmount===membership.contractedPrice);
 const opened=await http('cash-shifts/open','POST',{cashRegisterId:fixture.cashRegisterId,employeeId:context.employeeId,openingAmount:100,openingNotes:'Validación local ficticia.'},201);shift=opened.cashShiftId;
 const payment={memberId:member.memberId,orderId:null,branchId:fixture.branchId,totalAmount:20,currencyCode:'PEN',source:'RECEPTION',cashShiftId:shift,splits:[split(cash,20)],allocations:[{receivableId:debt.receivableId,amount:20}],requestId:randomUUID()};
 const paid=await http('payments','POST',payment,201);
 const replay=await http('payments','POST',payment,201);check('Payment replay same ID',paid.publicId===replay.publicId);
 const balance=(await http('receivables?memberId='+member.memberId)).items[0].balanceAmount;
 check('Partial payment leaves exact debt',balance===debt.balanceAmount-20);
 await http('payments','POST',{...payment,requestId:randomUUID(),totalAmount:balance,splits:[split(cash,10),split(yape,balance-10)],allocations:[{receivableId:debt.receivableId,amount:balance}]},201);
 check('Debt settled',!(await http('receivables?memberId='+member.memberId)).items.length);
 const sale={requestId:randomUUID(),branchId:fixture.branchId,memberId:member.memberId,cashShiftId:shift,currencyCode:'PEN',items:[{productPublicId:fixture.productPublicId,quantity:1,expectedUnitPrice:35}],splits:[split(cash,10),split(card,25)]};
 const sold=await http('store/sales','POST',sale);
 const again=await http('store/sales','POST',sale);check('POS replay same order and payment',sold.orderPublicId===again.orderPublicId&&sold.payment.publicId===again.payment.publicId);
 const receipt=await http('payments/'+sold.payment.publicId);check('Receipt item and split detail',receipt.items.length===1&&receipt.splits.length===2);
 await http('store/sales','POST',{...sale,requestId:randomUUID(),items:[{...sale.items[0],quantity:3}],splits:[split(yape,105)]},409);
 const stock=(await http('products?branchId='+fixture.branchId+'&search='+fixture.sku)).items[0].stock;check('Only successful sale reduces stock',stock===2);
 const movements=await http('cash-shifts/'+shift+'/movements?pageSize=100');check('Only three cash movements totaling 40',movements.items.length===3&&movements.items.reduce((s,m)=>s+m.amount,0)===40);
 const current=(await http('cash-shifts/me?status=OPEN')).items.find(s=>s.cashShiftId===shift);check('Expected cash excludes Yape/card',current.expectedAmount===140);
 const access=await http('access/check-in','POST',{memberId:member.memberId,branchId:fixture.branchId,accessMethod:'MANUAL',deviceId:null});check('Actual entry allowed',access.allowed);
 const history=await http('access/events?memberId='+member.memberId);check('Entry in paged history',history.items.some(e=>e.attendanceEventId===access.attendanceEventId));
 await http('classes/sessions/'+fixture.classSessionId+'/reserve/'+member.memberId,'POST',{},204);
 check('Confirmed class reservation',(await http('classes/sessions/'+fixture.classSessionId+'/participants')).items.some(p=>p.memberId===member.memberId&&p.status==='CONFIRMED'));
 const closed=await http('cash-shifts/'+shift+'/close','POST',{countedAmount:140,closingNotes:'Validación conciliada.'});check('Cash reconciles exactly',closed.expectedAmount===140&&closed.differenceAmount===0);shift=null;
 await writeFile(resolve(root,'backend/artifacts/reception-fixture.json'),JSON.stringify(fixture,null,2));
}finally{
 if(shift&&token){const rows=await http('cash-shifts/me?status=OPEN');const current=rows.items.find(s=>s.cashShiftId===shift);if(current)await http('cash-shifts/'+shift+'/close','POST',{countedAmount:current.expectedAmount,closingNotes:'Cierre de validación local interrumpida.'});}
 await writeFile(resolve(root,'backend/artifacts/reception-smoke.json'),JSON.stringify(checks,null,2));
 console.log(`${checks.filter(c=>c.pass).length}/${checks.length} real Reception HTTP checks passed; no credentials logged.`);
}
