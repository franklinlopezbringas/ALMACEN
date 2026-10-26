from pathlib import Path
import re, collections, json, sys

root = Path(__file__).resolve().parent
errors = []
notes = []

schema_files = sorted((root / "database").glob("0[1-9]_*.sql"))
sql = "\n".join(p.read_text(encoding="utf-8") for p in schema_files)
clean = re.sub(r"/\*.*?\*/", "", sql, flags=re.S)
clean = re.sub(r"--.*", "", clean)

tables = re.findall(r"CREATE TABLE\s+([\w]+\.[\w]+)\s*\((.*?)\)\s*;?\s*GO", clean, flags=re.S | re.I)
if len(tables) != 99:
    errors.append(f"Expected 99 physical tables, found {len(tables)}")

for name, body in tables:
    if re.search(r",\s*$", body):
        errors.append(f"Trailing comma before closing parenthesis in {name}")

constraint_names = re.findall(r"CONSTRAINT\s+([\w]+)", clean, flags=re.I)
for name, count in collections.Counter(x.lower() for x in constraint_names).items():
    if count > 1:
        errors.append(f"Duplicate constraint name: {name}")

index_names = re.findall(r"CREATE\s+(?:UNIQUE\s+)?INDEX\s+([\w]+)", clean, flags=re.I)
for name, count in collections.Counter(x.lower() for x in index_names).items():
    if count > 1:
        errors.append(f"Duplicate index name: {name}")

# FK dependency creation order.
created = set()
for path in schema_files:
    text = re.sub(r"/\*.*?\*/", "", path.read_text(encoding="utf-8"), flags=re.S)
    for match in re.finditer(r"CREATE TABLE\s+([\w]+\.[\w]+)\s*\((.*?)\)\s*;?\s*GO", text, flags=re.S | re.I):
        table, body = match.group(1).lower(), match.group(2)
        for target in re.findall(r"REFERENCES\s+([\w]+\.[\w]+)", body, flags=re.I):
            target = target.lower()
            if target not in created and target != table:
                errors.append(f"{table} references {target} before it is created")
        created.add(table)
    # ALTER TABLE FKs can appear after referenced table creation.
    for source, target in re.findall(r"ALTER TABLE\s+([\w]+\.[\w]+).*?REFERENCES\s+([\w]+\.[\w]+)", text, flags=re.S | re.I):
        if target.lower() not in created:
            errors.append(f"ALTER {source} references {target} before it is created")

# Permission names required by API must exist in permission seed.
used = set()
for p in (root / "backend/src/GymFlow.Api/Endpoints").glob("*.cs"):
    used.update(re.findall(r'RequirePermission\("([A-Z0-9_.]+)"\)', p.read_text(encoding="utf-8")))
seed = (root / "database/seeds/01_GlobalPermissions.sql").read_text(encoding="utf-8")
known = set(re.findall(r"\('([A-Z0-9_.]+)'", seed))
for permission in sorted(used - known):
    errors.append(f"API permission not seeded: {permission}")

cs_files = list((root / "backend").rglob("*.cs"))
for p in cs_files:
    text = p.read_text(encoding="utf-8")
    if text.count("{") != text.count("}"):
        errors.append(f"Rough brace mismatch in {p.relative_to(root)}")

result = {
    "physical_tables": len(tables),
    "csharp_files": len(cs_files),
    "api_permission_codes": len(used),
    "errors": errors,
    "notes": [
        "This is static validation only; it is not a substitute for SQL Server execution or dotnet build/test.",
        "Run CODEX_EXECUTION.md completion gates before labeling the package validated."
    ]
}
(root / "docs/STATIC_VALIDATION.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result, indent=2))
sys.exit(1 if errors else 0)
