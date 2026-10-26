"""Explicit local-only demo helper. Never resets passwords or prints credentials.
Uses the existing PasswordService PBKDF2 format; no third-party dependencies.
"""
from pathlib import Path
import base64
import hashlib
import os
import secrets
import subprocess

ROOT = Path(__file__).resolve().parents[2]
ENV = ROOT / 'frontend/.env.local'
ROLES = ('ADMIN', 'RECEPTION', 'TRAINER', 'MEMBER')
SQLCMD = r'C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn\SQLCMD.EXE'

def run(sql):
    result = subprocess.run([SQLCMD, '-S', r'.\SQLEXPRESS', '-E', '-C', '-b', '-d', 'GymFlowDb', '-h', '-1', '-W'],
                            input=sql, text=True, capture_output=True, check=False)
    if result.returncode:
        raise RuntimeError('Local demo SQL operation failed. No credentials are printed.')
    return result.stdout.strip()

def main():
    ignored = (ROOT / 'frontend/.gitignore').read_text(encoding='utf-8')
    if '.env*' not in ignored and '.env.local' not in ignored:
        raise RuntimeError('.env.local must be ignored before provisioning.')
    values = {}
    content = ENV.read_text(encoding='utf-8-sig') if ENV.exists() else ''
    for line in content.splitlines():
        if '=' in line and not line.startswith('#'):
            key, value = line.split('=', 1)
            values[key] = value.strip().strip('"')
    additions = []
    script = (ROOT / 'database/demo/E2EAccounts.sql').read_text(encoding='utf-8')
    for role in ROLES:
        email = role.lower() + '.e2e@example.test'
        key = f'GYMFLOW_E2E_{role}_PASSWORD'
        exists = run(f"SET NOCOUNT ON; SELECT COUNT(*) FROM security.Users WHERE NormalizedEmail=UPPER(N'{email}');")
        if exists != '0' and not values.get(key):
            raise RuntimeError('A demo identity exists without a local credential. Refusing to reset it.')
        password = values.get(key) or secrets.token_urlsafe(32)
        if not values.get(key):
            additions.extend([f'GYMFLOW_E2E_{role}_EMAIL={email}', f'{key}={password}'])
        salt = secrets.token_bytes(16)
        digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 210000, 32)
        encoded = 'pbkdf2-sha256$210000$' + base64.b64encode(salt).decode() + '$' + base64.b64encode(digest).decode()
        script = script.replace(f'$({role}_HASH)', encoded)
    # Persist before the SQL commit so an interrupted run never loses generated credentials.
    if additions:
        with ENV.open('a', encoding='utf-8') as output:
            output.write('\n# Dedicated fictitious local/demo accounts. NEVER use in production.\n' + '\n'.join(additions) + '\n')
    run(script)
    print('Four local demo identities ready. Credentials remain only in ignored frontend/.env.local.')

if __name__ == '__main__':
    main()
