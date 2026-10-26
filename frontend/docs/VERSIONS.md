# Versiones verificadas

Verificación: 2026-10-19, registro oficial https://registry.npmjs.org (dist-tag latest estable, engines y peerDependencies).
Node local: v24.13.0; pnpm: 12.14.0.

| Paquete | Versión usada |
|---|---|
| next | 16.4.2 |
| react | 19.3.1 |
| react-dom | 19.3.1 |
| @tanstack/react-query | 5.104.5 |
| react-hook-form | 7.90.0 |
| @hookform/resolvers | 6.0.0 |
| zod | 4.6.7 |
| lucide-react | 1.59.0 |
| @radix-ui/react-dialog | 1.3.1 |
| @radix-ui/react-slot | 1.5.0 |
| class-variance-authority | 0.7.1 |
| clsx | 2.1.1 |
| tailwind-merge | 3.7.0 |
| @fontsource-variable/manrope | 5.3.0 |
| typescript | 5.9.3 |
| @types/node | 24.19.2 |
| @types/react | 19.3.0 |
| @types/react-dom | 19.3.0 |
| tailwindcss | 4.3.3 |
| @tailwindcss/postcss | 4.3.3 |
| postcss | 8.5.31 |
| eslint | 9.39.5 |
| eslint-config-next | 16.4.2 |
| vitest | 5.0.5 |
| vite | 8.3.4 |
| jsdom | 29.1.1 |
| @testing-library/react | 16.3.3 |
| @testing-library/dom | 10.4.2 |
| @testing-library/jest-dom | 7.0.1 |
| @testing-library/user-event | 14.6.8 |
| @playwright/test | 1.64.1 |
| openapi-typescript | 7.13.0 |
| prettier | 3.9.10 |

Las versiones exactas y transitivas quedan fijadas en pnpm-lock.yaml. Instalación con strictPeerDependencies.

## Compatibilidad

- Next 16.4.2 acepta React ^19 y Node >=20.9; React y React DOM se fijan juntos en 19.3.1.
- TanStack Query, RHF, Radix y Testing Library declaran soporte React 19. Tailwind y su plugin PostCSS usan 4.3.3.
- TypeScript latest 7.0.2 no satisface openapi-typescript (^5.x) ni el parser ESLint (<6.1); se usa el estable compatible 5.9.3.
- ESLint latest 10.13.0 no satisface eslint-plugin-react 7.37.5 requerido por eslint-config-next (peer hasta ^9.7); se usa 9.39.5. npm marca esta rama deprecated; no se fuerza compatibilidad ni se deshabilitan reglas. Es la advertencia de instalación conocida, no una advertencia de lint/build.
- jsdom latest 30.1.3 exige Node >=24.15 en la rama 24; con Node 24.13 se selecciona 29.1.1. Vitest 5.0.5 y Vite 8.3.4 son compatibles con este Node.
- Los types de Node pertenecen a la rama 24; no se usan types 26 con runtime 24.
- Recharts se investigó (3.10.1) pero no se instaló: no hay un caso con datos históricos que justifique un gráfico en esta fase.
- El resolver nativo unrs-resolver 1.12.2 tiene autorización de postinstall limitada a esa versión; se revisó su instalación N-API.
- pnpm registra las excepciones de antigüedad para versiones estables recientes verificadas; no se instalaron paquetes preview/beta/RC/canary como dependencias directas.

Evidencia: registry-versions.json, compatibility-selection.json y additional-versions.json.
Fuentes: [Next installation](https://nextjs.org/docs/app/getting-started/installation), [pnpm build permissions](https://pnpm.io/cli/approve-builds), metadata del registro oficial guardada antes de la instalación.
