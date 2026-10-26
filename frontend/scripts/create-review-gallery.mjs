import { access, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const widths = [375, 768, 1440];
const screens = [
  ["admin", "Resumen del Administrador"],
  ["socios", "Socios y búsqueda"],
  ["registro-socio", "Registro de socio"],
  ["crm", "CRM · contactos y seguimientos"],
  ["membresias", "Membresías y estados"],
  ["crear-producto", "Crear producto"],
  ["crear-plan", "Crear plan"],
  ["participantes", "Participantes y reservas"],
  ["clases", "Agenda de clases"],
  ["catalogo", "Catálogo"],
  ["planes", "Planes"],
  ["notificaciones", "Notificaciones"],
  ["login", "Inicio de sesión"],
  ["publica", "Web pública"],
];
const root = new URL("../artifacts/review/", import.meta.url);
for (const [name] of screens)
  for (const width of widths)
    await access(new URL(`${width}/${name}.png`, root));
const sections = screens
  .map(
    ([name, title]) =>
      `<section id="${name}"><h2>${title}</h2><div class="grid">${widths.map((width) => `<a href="${width}/${name}.png"><span>${width} px · Abrir captura completa</span><img loading="lazy" src="${width}/${name}.png" alt="${title} a ${width} píxeles"></a>`).join("")}</div></section>`,
  )
  .join("");
await writeFile(
  new URL("index.html", root),
  `<!doctype html>
<html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>GymFlow · Revisión visual Foundation + Admin</title>
<style>body{margin:0;background:#f4f6f2;color:#172e24;font:16px/1.6 system-ui,sans-serif}main{max-width:1440px;margin:auto;padding:32px}h1{line-height:1.2}nav{display:flex;flex-wrap:wrap;gap:12px}a{color:#28624b}section{margin-top:48px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.grid a{border:1px solid #dce2d8;border-radius:12px;background:white;overflow:hidden;text-decoration:none}.grid span{display:block;padding:12px;font-weight:600;font-size:14px}img{display:block;width:100%;height:340px;object-fit:cover;object-position:top;border-top:1px solid #dce2d8}.notice{padding:20px;border:1px solid #bbcba8;border-radius:12px;background:#e9f0df}:focus-visible{outline:3px solid #28624b;outline-offset:3px}@media(max-width:767px){main{padding:20px}.grid{grid-template-columns:1fr}}</style>
<main><h1>GymFlow · Administrador · patch de integración</h1><p>Identidad visual conservada · 21 de octubre de 2026 · 42 capturas · 375 / 768 / 1440 px.</p>
<p class="notice"><strong>Datos simulados de pruebas.</strong> Estas imágenes proceden de un servidor E2E aislado, no de cuentas autenticadas en GymFlowDb. Los nombres, métricas y precios ilustran la interfaz. Login y refresh de los cuatro roles se validaron por separado contra GymFlow.Api real. Frontend no finalizado.</p>
<nav aria-label="Pantallas">${screens.map(([name, title]) => `<a href="#${name}">${title}</a>`).join("")}</nav>${sections}</main></html>`,
  "utf8",
);
console.log(`Gallery: ${fileURLToPath(new URL("index.html", root))}`);
