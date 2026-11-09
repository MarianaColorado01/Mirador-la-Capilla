# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Stack

Wireframes: static HTML/CSS (requested by the user). Final app: React Native + Expo + TypeScript, Expo Router (Stack, Tabs, Drawer), NativeWind, TanStack Query, Zustand. Server: Node.js + Express + SQLite + Socket.IO on the cashier PC.

## Users

- Mesero / operador único (primary): attends tables, phone in one hand, often in a hurry.
- Barra (preparador): watches incoming rounds and moves them through states.
- Caja (cajero): collects payment, applies discount/tip, invoices, voids with reason.
- Dueño: everything above plus inventory, purchases, expenses, users, reports, backups.
- Monday–Saturday one person does everything ("Todo en uno"); Sundays 1 bar, 1 cashier, 2 waiters on several phones.

## Product Purpose

Digitise the cycle pedido → cuenta → inventario → factura → surtido of the bar and liquor store "Mirador la Capilla". Success: exact charges, rounds that reach the bar instantly, stock always current, estimated profit visible to the owner, all without internet.

## Positioning

Runs entirely on the venue's local Wi-Fi against one PC; no cloud. Server is the single source of truth (stock validation, invoice numbering, transactions).

## Operating Context

Used both at night in low light and during the day in the lit liquor store, equally. Several phones share state in real time. Connection to the local server can drop; the round in progress must survive.

## Capabilities and Constraints

71 functional requirements across 12 modules (Requerimientos_Funcionales_POS_Bar.pdf, 3 nov 2026). All priorities (Alta, Media, Baja) are in scope for the wireframes. Key rules: one open account per table; stock only changes through movements; prices/costs frozen per item; nothing is deleted (voids keep user, date, reason); consecutive invoice numbers; role-based tabs/drawer. Table colours are fixed by RF-16: libre verde, ocupada naranja, por cobrar rojo.

## Brand Commitments

Business name: "Mirador La Capilla". Product: Bar POS.

From the client's Instagram (instagram.com/miradorlacapilla, reviewed 2026-11-04, logged out): "Mirador paisajístico cultural cafetero · Restaurante, café bar", Km 3 vía Belalcázar – La Virginia, vereda La Alemania. Logo is a weathered wooden plank with routed roman-capital letters "MIRADOR / LA CAPILLA" and a green painted trim stripe; an alternate mark sets the name in white serif caps with a gold location pin. Content shows coffee-landscape mountain views and sunsets, a red heart sculpture (lit at night), colourful painted rails and hammocks, a glass gallery with wooden floor, local food (arepas, chorizo), live music and mariachi events.

## Evidence on Hand

Sample data in the existing Figma wireframes (products Águila 330 ml, Club Colombia, Aguardiente 1/2, Ron botella, Mojito; waiters Ana, Luis; supplier Distribuidora X; invoice #000128). Real bar coordinates are still pending with the teacher; do not invent them as fact.

## Product Principles

1. Few taps per order: the waiter's path is the fastest path.
2. Never show a false confirmation: offline states disable commits and say so.
3. Server truth over phone convenience.
4. Every change is traceable, nothing is erased.
5. Role decides what is visible.
