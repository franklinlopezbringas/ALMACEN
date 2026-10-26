"""Real SQL Server + HTTP integration and k6 runner. Creates isolated fictitious tenants.

Run with: py tests/integration_api.py [--load] [--keep-api]
Secrets are generated in memory and passed only through process environments.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
import argparse
import base64
import hashlib
import hmac
import json
import os
import secrets
import subprocess
import time
import urllib.request
import urllib.error
import uuid

BACKEND = Path(__file__).resolve().parents[1]
ROOT = BACKEND.parent
OUT = BACKEND / 'artifacts'
OUT.mkdir(exist_ok=True)
BASE = 'http://127.0.0.1:5080'
SQLCMD = ['sqlcmd', '-S', r'.\SQLEXPRESS', '-E', '-C', '-b', '-d', 'GymFlowDb', '-w', '65535', '-y', '0']
checks = []


def sql(query=None, file=None, variables=None, fail=False):
    args = SQLCMD + (['-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; '+query] if query is not None else ['-i', str(file)])
    if variables:
        args += ['-v'] + variables
    result = subprocess.run(args, capture_output=True, text=True, encoding='utf-8', errors='replace')
    if fail:
        verify(result.returncode != 0, 'SQL rejects invalid mutation')
    elif result.returncode:
        raise AssertionError(result.stdout + result.stderr)
    return result.stdout.strip()


def scalar(query):
    return sql(query).splitlines()[0].strip()


def verify(condition, label):
    if not condition:
        raise AssertionError(label)
    checks.append(label)
    print('PASS '+label, flush=True)


def api(method, path, token=None, body=None, expected=200):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer '+token
    req = urllib.request.Request(BASE+path, data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            status, data = response.status, response.read()
    except urllib.error.HTTPError as ex:
        status, data = ex.code, ex.read()
    allowed = expected if isinstance(expected, tuple) else (expected,)
    if status not in allowed:
        raise AssertionError(f'{method} {path}: expected {allowed}, got {status}: {data.decode()[:600]}')
    return json.loads(data) if data and data[:1] in (b'{', b'[') else status


def run(args):
    tag = uuid.uuid4().hex
    raw = sql(file=ROOT/'database/tests/ApiFixtures.sql', variables=['RunTag='+tag])
    f = json.loads(raw[raw.index('{'):])
    (OUT/'integration-fixture.json').write_text(json.dumps(f, indent=2))
    password = secrets.token_urlsafe(36)
    env = os.environ.copy()
    env.update(ASPNETCORE_ENVIRONMENT='Development', ASPNETCORE_URLS=BASE,
               Jwt__SigningKey=secrets.token_urlsafe(64), GYMFLOW_DEMO_PASSWORD=password,
               ConnectionStrings__GymFlow=r'Server=.\SQLEXPRESS;Database=GymFlowDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True;')
    dotnet = BACKEND/'.tools/dotnet/dotnet.exe'
    api_log = open(OUT/'api.log', 'w', encoding='utf-8')
    process = subprocess.Popen([str(dotnet), str(BACKEND/'src/GymFlow.Api/bin/Release/net10.0/GymFlow.Api.dll')],
                               cwd=BACKEND/'src/GymFlow.Api', env=env, stdout=api_log, stderr=subprocess.STDOUT,
                               creationflags=subprocess.CREATE_NO_WINDOW)
    (OUT/'api.pid').write_text(str(process.pid))
    try:
        for _ in range(100):
            if process.poll() is not None:
                raise AssertionError('API exited. See artifacts/api.log')
            try:
                api('GET','/health/ready')
                break
            except (OSError, AssertionError):
                time.sleep(.25)
        verify(api('GET','/health/live') == 200, 'API live')
        verify(api('GET','/health/ready')['status']=='ready', 'SQL readiness')
        verify('paths' in api('GET','/openapi/v1.json'), 'OpenAPI')
        tokens={}
        for role in ('admin','reception','trainer','member','other'):
            response=api('POST','/api/v1/auth/login', body={'email':role+'.'+tag+'@demo.gymflow.local','password':password,'organizationPublicId':f['otherOrg'] if role=='other' else f['org']})
            tokens[role]=response['accessToken']
            verify(len(response['user']['roles'])==1, 'Login '+role)
            if role=='admin': refresh=response['refreshToken']
        admin=tokens['admin']; member=tokens['member']; trainer=tokens['trainer']; other=tokens['other']
        api('POST','/api/v1/auth/login',body={'email':'admin.'+tag+'@demo.gymflow.local','password':password,'organizationPublicId':f['otherOrg']},expected=401)
        verify(True,'Login rejects unauthorized tenant')
        def refresh_once(_):
            return api('POST','/api/v1/auth/refresh',body={'refreshToken':refresh},expected=(200,401))
        with ThreadPoolExecutor(2) as pool: rotated=list(pool.map(refresh_once, range(2)))
        verify(sum(isinstance(x,dict) for x in rotated)==1,'Refresh single-use under concurrency')
        next_refresh=next(x['refreshToken'] for x in rotated if isinstance(x,dict))
        api('POST','/api/v1/auth/refresh',body={'refreshToken':refresh},expected=401)
        verify(True,'Refresh replay rejected')
        sql(f"UPDATE security.Users SET FailedAccessCount=7 WHERE Email='reception.{tag}@demo.gymflow.local'")
        api('POST','/api/v1/auth/login',body={'email':'reception.'+tag+'@demo.gymflow.local','password':'incorrect','organizationPublicId':f['org']},expected=401)
        verify(int(scalar(f"SELECT COUNT(*) FROM security.Users WHERE Email='reception.{tag}@demo.gymflow.local' AND FailedAccessCount=8 AND LockoutEndUtc>SYSUTCDATETIME()"))==1,'Password lockout threshold')
        api('POST','/api/v1/auth/login',body={'email':'reception.'+tag+'@demo.gymflow.local','password':password,'organizationPublicId':f['org']},expected=429)
        verify(True,'Authentication rate limit enforced')
        api('GET','/api/v1/members',admin[:-12]+'invalidtoken',expected=401)
        verify(True,'Tampered JWT rejected')
        api('GET','/api/v1/members',expected=401)
        for role in ('member','trainer'):
            api('GET','/api/v1/members',tokens[role],expected=403)
        api('GET','/api/v1/members',tokens['reception'])
        api('POST','/api/v1/automation/jobs',tokens['reception'],{'jobType':'REPORT','payloadJson':'{}','priority':5},expected=403)
        verify(True,'Role and permission matrix')
        verify(api('GET','/api/v1/members?pageSize=10000',admin)['pageSize']==100,'Pagination capped at 100')
        verify(api('GET','/api/v1/members',admin)['total']==1,'Tenant A list scoped')
        verify(api('GET','/api/v1/members',other)['total']==1,'Tenant B list scoped')
        api('GET','/api/v1/members/'+f['otherMemberPublic'],admin,expected=404)
        api('POST','/api/v1/members',admin,{'firstName':'Invalid','lastName':'Tenant','homeBranchId':f['otherBranch']},expected=409)
        verify(True,'Tenant read and write isolation')
        created=[]
        for i in range(4):
            result=api('POST','/api/v1/members',admin,{'firstName':'Test'+str(i),'lastName':tag,'homeBranchId':f['branch']},expected=201)
            created.append(int(scalar("SELECT MemberId FROM core.Members WHERE PublicId='"+result['publicId']+"'")))
        verify(len(created)==4,'Member creation persists in SQL')
        prospect=api('POST','/api/v1/prospects',admin,{'firstName':'Prospect','lastName':tag},expected=201)['prospectId']
        converted=api('POST',f'/api/v1/prospects/{prospect}/convert',admin,{'homeBranchId':f['branch']})
        again=api('POST',f'/api/v1/prospects/{prospect}/convert',admin,{'homeBranchId':f['branch']})
        verify(converted['publicId']==again['publicId'],'CRM conversion idempotent and history retained')
        verify(api('GET','/api/v1/prospects?status=WON',admin)['total']==1,'CRM paginated status query')
        verify(len(api('GET',f"/api/v1/public/{f['org']}/plans"))==1,'Public plan catalog')
        today=datetime.now(timezone.utc).date().isoformat()
        memberships=[]
        for mid in (f['member'],created[0]):
            memberships.append(api('POST','/api/v1/memberships',admin,{'memberId':mid,'planVersionId':f['version'],'homeBranchId':f['branch'],'startDate':today,'origin':'RECEPTION'},expected=201))
        verify(all(x['contractedPrice']==120 for x in memberships),'Membership price snapshot and receivable')
        verify(len(api('GET','/api/v1/memberships/expiring?days=90',admin))==2,'Expiring membership query translates and returns contracts')
        free_version=int(scalar(f"INSERT membership.PlanVersions(OrganizationId,PlanId,VersionNumber,Price,CurrencyCode,DurationValue,DurationUnit,ValidFrom) SELECT OrganizationId,PlanId,2,0,'PEN',1,'MONTH',CONVERT(date,SYSUTCDATETIME()) FROM membership.PlanVersions WHERE PlanVersionId={f['version']}; SELECT CONVERT(bigint,SCOPE_IDENTITY());"))
        free=api('POST','/api/v1/memberships',admin,{'memberId':created[3],'planVersionId':free_version,'homeBranchId':f['branch'],'startDate':today,'origin':'PROMOTION'},expected=201)
        verify(free['contractedPrice']==0 and free['receivableId'] is None,'Zero-price plan creates membership without invalid receivable')
        api('POST','/api/v1/memberships',admin,{'memberId':f['otherMember'],'planVersionId':f['version'],'startDate':today,'origin':'RECEPTION'},expected=409)
        shift=api('POST','/api/v1/cash-shifts/open',admin,{'cashRegisterId':f['registerId'],'employeeId':f['employee'],'openingAmount':200},expected=201)['cashShiftId']
        api('POST','/api/v1/cash-shifts/open',admin,{'cashRegisterId':f['registerId'],'employeeId':f['employee'],'openingAmount':0},expected=409)
        verify(True,'Single open cash shift')
        def payment(mid,rid,total,splits):
            return {'memberId':mid,'branchId':f['branch'],'totalAmount':total,'currencyCode':'PEN','source':'RECEPTION','cashShiftId':shift,'splits':[{'paymentMethodId':method,'amount':amount} for method,amount in splits],'allocations':[{'receivableId':rid,'amount':total}]}
        mixed=payment(f['member'],memberships[0]['receivableId'],120,[(f['cash'],40),(f['yape'],80)])
        invalid=json.loads(json.dumps(mixed))
        invalid['splits'][0]['externalReference']='x'*151
        before=int(scalar(f"SELECT COUNT(*) FROM finance.Payments WHERE OrganizationId={f['orgId']}"))
        api('POST','/api/v1/payments',admin,invalid,expected=400)
        verify(int(scalar(f"SELECT COUNT(*) FROM finance.Payments WHERE OrganizationId={f['orgId']}"))==before,'Failed split rolls back parent payment')
        p=api('POST','/api/v1/payments',admin,mixed,expected=201)
        verify(float(scalar(f'SELECT SUM(Amount) FROM finance.CashMovements WHERE CashShiftId={shift}'))==40,'Mixed S/40 cash + S/80 Yape: cash only S/40')
        api('POST','/api/v1/payments',admin,mixed,expected=409)
        partial=payment(created[0],memberships[1]['receivableId'],50,[(f['yape'],50)])
        api('POST','/api/v1/payments',admin,partial,expected=201)
        verify(float(scalar(f"SELECT BalanceAmount FROM finance.vw_ReceivableBalances WHERE ReceivableId={memberships[1]['receivableId']}"))==70,'Partial S/50 of S/120 leaves S/70')
        verify(float(scalar(f'SELECT SUM(Amount) FROM finance.CashMovements WHERE CashShiftId={shift}'))==40,'Digital payment does not affect drawer')
        remaining=payment(created[0],memberships[1]['receivableId'],70,[(f['yape'],70)])
        with ThreadPoolExecutor(2) as pool:
            results=list(pool.map(lambda _:api('POST','/api/v1/payments',admin,remaining,expected=(201,409)),range(2)))
        verify(sum(isinstance(x,dict) and 'paymentId' in x for x in results)==1,'Concurrent payments cannot overpay')
        close=api('POST',f'/api/v1/cash-shifts/{shift}/close',admin,{'countedAmount':240})
        verify(close['expectedAmount']==240 and close['differenceAmount']==0 and close['status']=='CLOSED','Cash closing reconciliation')
        denied=api('POST','/api/v1/access/check-in',admin,{'memberId':created[1],'branchId':f['branch'],'accessMethod':'MANUAL'})
        verify(not denied['allowed'] and denied['reasonCode']=='NO_ACTIVE_MEMBERSHIP','Access denied without membership')
        allowed=api('POST','/api/v1/access/check-in',admin,{'memberId':f['member'],'branchId':f['branch'],'accessMethod':'QR'})
        verify(allowed['allowed'],'Active membership check-in')
        sql(f"UPDATE core.Members SET Status='BLOCKED' WHERE MemberId={f['member']}")
        blocked=api('POST','/api/v1/access/check-in',admin,{'memberId':f['member'],'branchId':f['branch'],'accessMethod':'MANUAL'})
        verify(not blocked['allowed'] and blocked['reasonCode']=='MEMBER_INACTIVE','Blocked member cannot enter with active membership')
        sql(f"UPDATE core.Members SET Status='ACTIVE' WHERE MemberId={f['member']}")
        sql(f"INSERT access.AccessExceptions(OrganizationId,MemberId,Reason,ValidFromUtc,ValidToUtc,Status,RequestedByUserId,ReviewedByUserId) VALUES({f['orgId']},{created[1]},'Validation',DATEADD(minute,-1,SYSUTCDATETIME()),DATEADD(hour,1,SYSUTCDATETIME()),'APPROVED',{f['adminUser']},{f['adminUser']})")
        exception=api('POST','/api/v1/access/check-in',admin,{'memberId':created[1],'branchId':f['branch'],'accessMethod':'MANUAL'})
        verify(exception['allowed'] and exception['result']=='EXCEPTION','Approved current exception permits access')
        api('POST','/api/v1/access/check-in',admin,{'memberId':f['otherMember'],'branchId':f['branch'],'accessMethod':'MANUAL'},expected=409)
        api('POST',f"/api/v1/classes/sessions/{f['sessionId']}/reserve/me",member,{},expected=204)
        with ThreadPoolExecutor(4) as pool:
            list(pool.map(lambda mid:api('POST',f"/api/v1/classes/sessions/{f['sessionId']}/reserve/{mid}",admin,{},expected=204),created))
        verify(int(scalar(f"SELECT COUNT(*) FROM training.ClassReservations WHERE ClassSessionId={f['sessionId']} AND Status='CONFIRMED'"))==2,'Class concurrency respects capacity')
        verify(int(scalar(f"SELECT COUNT(DISTINCT WaitlistPosition) FROM training.ClassReservations WHERE ClassSessionId={f['sessionId']} AND Status='WAITLISTED'"))==3,'Class overflow has distinct waitlist positions')
        waiting=int(scalar(f"SELECT TOP(1) MemberId FROM training.ClassReservations WHERE ClassSessionId={f['sessionId']} AND Status='WAITLISTED' ORDER BY WaitlistPosition"))
        sql(f"UPDATE training.ClassReservations SET Status='CANCELLED',CancelledAtUtc=SYSUTCDATETIME() WHERE ClassSessionId={f['sessionId']} AND MemberId={waiting}")
        api('POST',f"/api/v1/classes/sessions/{f['sessionId']}/reserve/{waiting}",admin,{},expected=204)
        verify(int(scalar(f"SELECT COUNT(*) FROM training.ClassReservations WHERE ClassSessionId={f['sessionId']} AND MemberId={waiting} AND Status='WAITLISTED' AND CancelledAtUtc IS NULL"))==1,'Cancelled reservation can be rebooked without duplicate key')
        api('POST',f"/api/v1/classes/sessions/{f['sessionId']}/reserve/{created[0]}",member,{},expected=403)
        verify(api('GET','/api/v1/trainer/members',trainer)['total']==1,'Trainer sees assigned members')
        progress={'memberId':f['member'],'rating':'GOOD_PROGRESS','progressPercentage':40,'visibleComment':'Validation','privateNote':'Staff only'}
        api('POST','/api/v1/trainer/progress-reviews',trainer,progress,expected=201)
        progress['memberId']=created[0]
        api('POST','/api/v1/trainer/progress-reviews',trainer,progress,expected=403)
        verify(True,'Progress restricted to assigned trainer')
        verify(api('GET',f"/api/v1/products?branchId={f['branch']}",member)['items'][0]['stock']==10,'Product inventory read')
        verify(api('GET','/api/v1/loyalty/me/balance',member)['currentBalance']==110,'GymPoints ledger balance')
        with ThreadPoolExecutor(2) as pool:
            redeemed=list(pool.map(lambda _:api('POST',f"/api/v1/loyalty/me/rewards/{f['reward']}/redeem",member,{},expected=(200,409)),range(2)))
        verify(sum(isinstance(x,dict) and 'redemptionId' in x for x in redeemed)==1,'Reward concurrency enforces stock and points')
        verify(api('GET','/api/v1/loyalty/me/balance',member)['currentBalance']==50,'Reward ledger reconciles after debit')
        verify(api('GET','/api/v1/notifications/me',member)['total']==1,'Personal notifications')
        api('POST',f"/api/v1/notifications/{f['notification']}/read",other,{},expected=409)
        api('POST',f"/api/v1/notifications/{f['notification']}/read",member,{},expected=204)
        verify(api('GET','/api/v1/notifications/me',member)['items'][0]['status']=='READ','Notification ownership and read status')
        job=api('POST','/api/v1/automation/jobs',admin,{'jobType':'REPORT','payloadJson':'{}','priority':5},expected=202)
        verify(api('GET','/api/v1/automation/jobs/'+job['publicId'],admin)['status']=='PENDING','Durable job enqueue and retrieval')
        api('GET','/api/v1/automation/jobs/'+job['publicId'],other,expected=404)
        verify(True,'Job tenant isolation')
        sql(file=ROOT/'database/tests/IntegrityTests.sql')
        verify(True,'SQL IntegrityTests after API mutations')
        sql(file=ROOT/'database/tests/OperationalTests.sql')
        verify(True,'Inventory, workout and job SQL lifecycles with rollback')
        # Database defenses are exercised directly as well as through HTTP.
        sql(f"INSERT core.Members(OrganizationId,PersonId,MemberCode) SELECT {f['orgId']},PersonId,'INVALID' FROM core.Members WHERE MemberId={f['otherMember']}",fail=True)
        sql(f"UPDATE commerce.InventoryBalances SET QuantityOnHand=-1 WHERE ProductId={f['product']}",fail=True)
        sql(f"INSERT finance.CashMovements(OrganizationId,CashShiftId,MovementType,Amount,PaymentSplitId,Description,CreatedByUserId) SELECT {f['orgId']},{shift},'INCOME',s.Amount,s.PaymentSplitId,'INVALID',{f['adminUser']} FROM finance.PaymentSplits s WHERE s.PaymentId={p['paymentId']} AND s.PaymentMethodId={f['yape']}",fail=True)
        verify(int(scalar('SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0'))==99,'99 physical tables')
        verify(int(scalar('SELECT COUNT(*) FROM sys.foreign_keys WHERE is_disabled=1 OR is_not_trusted=1'))==0,'All FKs enabled and trusted')
        verify(int(scalar('SELECT COUNT(*) FROM sys.check_constraints WHERE is_disabled=1 OR is_not_trusted=1'))==0,'All CHECK constraints enabled and trusted')
        verify(int(scalar("SELECT COUNT(*) FROM sys.tables t WHERE NOT EXISTS(SELECT 1 FROM sys.key_constraints k WHERE k.parent_object_id=t.object_id AND k.type='PK')"))==0,'Every table has primary key')
        old=scalar(f"SELECT sys.fn_varbintohexstr(RowVersion) FROM core.Members WHERE MemberId={f['member']}")
        sql(f"UPDATE core.Members SET Status=Status WHERE MemberId={f['member']}")
        verify(scalar(f"SELECT sys.fn_varbintohexstr(RowVersion) FROM core.Members WHERE MemberId={f['member']}")!=old,'SQL rowversion changes on update')
        sql(f"UPDATE core.Members SET Status='BLOCKED' WHERE MemberId={f['member']} AND RowVersion={old}; IF @@ROWCOUNT<>0 THROW 51998,'Stale update accepted',1;")
        verify(True,'Stale rowversion cannot update')
        if args.load:
            k6=next((BACKEND/'.tools/k6').rglob('k6.exe'))
            # Data-endpoint load uses distinct persisted identities. Authentication
            # is verified above; token provisioning is outside the timed workload.
            sql(f"""DECLARE @i int=1; WHILE @i<={args.vus} BEGIN
                DECLARE @email nvarchar(320)=CONCAT('load-',@i,'.{tag}@demo.gymflow.local');
                INSERT security.Users(Email,NormalizedEmail,EmailVerified,Status) VALUES(@email,UPPER(@email),1,'ACTIVE');
                DECLARE @uid bigint=SCOPE_IDENTITY();
                INSERT security.UserOrganizations(OrganizationId,UserId) VALUES({f['orgId']},@uid);
                DECLARE @uo bigint=SCOPE_IDENTITY();
                INSERT security.UserRoles(OrganizationId,UserOrganizationId,RoleId) SELECT {f['orgId']},@uo,RoleId FROM security.Roles WHERE OrganizationId={f['orgId']} AND Code='ADMIN';
                SET @i+=1; END;""")
            users=json.loads(''.join(sql(f"SELECT UserId,PublicId FROM security.Users WHERE Email LIKE 'load-%.{tag}@demo.gymflow.local' FOR JSON PATH").splitlines()))
            encode=lambda value:base64.urlsafe_b64encode(value).rstrip(b'=')
            load_tokens=[]
            for user in users:
                payload={'iss':'GymFlow','aud':'GymFlow.Client','sub':user['PublicId'],'uid':str(user['UserId']),'org':str(f['orgId']),'org_public':f['org'],'exp':int(time.time())+900,'nbf':int(time.time())-5,'jti':uuid.uuid4().hex,'perm':['MEMBERS.VIEW','DASHBOARD.VIEW','CLASSES.VIEW']}
                unsigned=encode(b'{"alg":"HS256","typ":"JWT"}')+b'.'+encode(json.dumps(payload).encode())
                load_tokens.append((unsigned+b'.'+encode(hmac.new(env['Jwt__SigningKey'].encode(),unsigned,hashlib.sha256).digest())).decode())
            load_env=env.copy(); load_env.update(BASE_URL=BASE, MAX_VUS=str(args.vus))
            load_env.update({f'ACCESS_TOKEN_{i+1}':token for i,token in enumerate(load_tokens)})
            with open(OUT/f'load-{args.vus}.log','w') as log:
                result=subprocess.run([str(k6),'run','--summary-export',str(OUT/f'load-summary-{args.vus}.json'),str(BACKEND/'load-tests/gymflow-smoke.js')],env=load_env,stdout=log,stderr=subprocess.STDOUT)
            verify(result.returncode==0,'k6 supplied load stages and thresholds')
            summary=json.loads((OUT/f'load-summary-{args.vus}.json').read_text())
            verify(summary['metrics']['vus']['max']==args.vus,f'k6 reached {args.vus} concurrent users')
            api('POST','/api/v1/auth/login',body={'email':'reception.'+tag+'@demo.gymflow.local','password':password,'organizationPublicId':f['org']},expected=401)
            verify(True,'Locked user cannot log in with correct password')
            sql(f"UPDATE security.Roles SET Status='INACTIVE' WHERE OrganizationId={f['orgId']} AND Code='ADMIN'")
            refreshed=api('POST','/api/v1/auth/refresh',body={'refreshToken':next_refresh})
            verify(not refreshed['user']['roles'] and not refreshed['user']['permissions'],'Inactive roles grant no permissions on token rotation')
            api('GET','/api/v1/members',refreshed['accessToken'],expected=403)
            sql(f"UPDATE security.Roles SET Status='ACTIVE' WHERE OrganizationId={f['orgId']} AND Code='ADMIN'")
        report=json.dumps({'status':'PASS','checks':checks,'fixture':f,'apiPid':process.pid},indent=2)
        (OUT/'integration-results.json').write_text(report)
        if args.load: (OUT/f'integration-results-{args.vus}.json').write_text(report)
    finally:
        if not args.keep_api:
            process.terminate()
            process.wait(timeout=15)
        api_log.close()


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--load',action='store_true')
    parser.add_argument('--vus',type=int,choices=(50,100),default=50)
    parser.add_argument('--keep-api',action='store_true')
    options=parser.parse_args()
    try:
        run(options)
    except Exception as ex:
        (OUT/'integration-results.json').write_text(json.dumps({'status':'FAIL','checks':checks,'error':str(ex)},indent=2))
        raise
