"""Validate canonical installers in a new database; never delete existing data."""
from pathlib import Path
import re
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / 'database'
ARTIFACTS = ROOT / 'backend/artifacts'
ARTIFACTS.mkdir(exist_ok=True)


def expand(path):
    text = path.read_text(encoding='utf-8')
    return re.sub(r'^:r (.+)$', lambda m: expand(DB / m[1].strip().replace('\\', '/')), text, flags=re.M)


def run(path):
    result = subprocess.run(['sqlcmd', '-S', r'.\SQLEXPRESS', '-E', '-C', '-b', '-i', str(path)], capture_output=True, text=True)
    print(result.stdout)
    if result.returncode:
        raise RuntimeError(result.stderr or result.stdout)


if __name__ == '__main__':
    # Existing installations receive only additive definitions from the canonical schema.
    lines = ['USE GymFlowDb;', 'GO', 'SET QUOTED_IDENTIFIER ON;', 'GO']
    targets = {'Payments', 'Exercises', 'WorkoutTemplates', 'Products', 'Rewards', 'Jobs'}
    for path in sorted(DB.glob('0[1-9]_*.sql')):
        for table, body in re.findall(r'CREATE TABLE (\w+\.\w+)\s*\((.*?)\)\s*;\s*GO', path.read_text(encoding='utf-8'), re.S):
            schema, name = table.split('.')
            if name in targets:
                definition = re.search(r'CONSTRAINT FK_'+name+r'_Organization[^\r\n]+', body)[0].rstrip(',')
                lines += [f"IF OBJECT_ID(N'{schema}.FK_{name}_Organization', N'F') IS NULL", f'ALTER TABLE {table} ADD {definition};', 'GO']
    finance = (DB / '04_Finance_Cash.sql').read_text(encoding='utf-8')
    lines += ["IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'finance.CashMovements') AND name=N'UX_CashMovements_PaymentSplit')", re.search(r'CREATE UNIQUE INDEX UX_CashMovements_PaymentSplit.*?;', finance)[0], 'GO']
    lines += [re.search(r'CREATE OR ALTER TRIGGER finance.TR_CashMovements_Validate.*?\nGO', finance, re.S)[0]]
    (DB / 'patches').mkdir(exist_ok=True)
    patch = DB / 'patches/20261015_ValidationHardening.sql'
    patch.write_text('\n'.join(lines)+'\n', encoding='utf-8')
    run(patch)

    name = 'GymFlowValidation_' + uuid.uuid4().hex[:12]
    script = ARTIFACTS / 'clean-install.sql'
    script.write_text((expand(DB / '98_InstallSchema.sql')+'\n'+expand(DB / '99_InstallDemo.sql')+'\n'+expand(DB / '99_InstallDemo.sql')).replace('GymFlowDb', name), encoding='utf-8')
    run(script)
    (ARTIFACTS / 'clean-install-database.txt').write_text(name, encoding='utf-8')
    print(f'Clean schema + demo + repeat demo: PASS ({name})')
