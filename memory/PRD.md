# PRD — Wholesaler & Supply Manager (Kirana Bahi Khata)

## Original problem statement
Simple, mobile-friendly web app for a kirana grocery shop owner dealing with 5+ wholesalers with mixed payment terms. Move from zero tracking to a simple digital ledger covering wholesalers, orders, payments, price comparison and low-stock reordering. Hindi/English mixed input, one-handed phone use, large tap targets, persistent data.

## User personas
- Kirana shopkeeper (primary): 30-55 yrs, uses phone in busy shop with one hand, comfortable in Hinglish, wants a "bahi khata" digital replacement.

## Core requirements (static)
- Full JWT auth (email + password)
- Mobile-first, large 48-56px tap targets, bottom nav
- INR (₹) + DD/MM/YYYY everywhere
- Hindi/English full-UI toggle
- Persistent MongoDB storage

## Architecture / stack
- Backend: FastAPI + Motor + MongoDB, httpOnly-cookie JWT auth, per-user owner_id scoping
- Frontend: React (CRA + Craco), react-router v7, TailwindCSS, Shadcn UI, lucide-react icons, sonner toast
- i18n: custom I18nContext + translations.js (en/hi)

## Implemented (07 Feb 2026 — initial MVP)
- Auth: register / login / logout / me — bcrypt + JWT + httpOnly cookies (12h access, 30d refresh)
- Admin seed (admin@kirana.shop / admin123) + demo data on first startup: 6 wholesalers, 9 orders (with discrepancies), 4 payments, 7 inventory items
- Wholesaler directory — CRUD, items as tags, payment terms Credit/Cash/Depends, credit-period days, notes
- Order log — CRUD with items[qty/unit/price], expected & actual delivery dates, status (Pending/Delivered/Delayed/Partially Delivered), discrepancy flag (damaged/short/wrong) + note, filter by wholesaler
- Payment tracker — CRUD, per-wholesaler owed computed from orders − payments, red/yellow/green due-date status, overall dashboard total
- Price comparison — per-item wholesaler prices with lowest highlighted, trend (up/down/flat) from historical orders
- Inventory + low-stock — CRUD with threshold; smart reorder suggestion (lowest price × fewest issues)
- Home dashboard — 4 stat cards (total owed / overdue / pending orders / low stock) + per-wholesaler owed list + low-stock quick view
- Hindi/English toggle in sticky header (persists in localStorage)
- Bahi Khata theme: warm paper background (#F5F3EC), Manrope typography, tabular-nums, status pills

## Backlog (deferred / P1)
- P1: Order edit (currently create + delete + status-only via new order)
- P1: Payment allocation to specific order id (schema supports order_id but UI hides it)
- P1: CSV export of orders/payments
- P2: WhatsApp share of pending payment reminder to wholesaler phone
- P2: Multi-user staff accounts (admin invites)
- P2: Weekly/monthly summary PDF for the shop owner

## Testing
- iteration_1: all read endpoints + all pages render OK
- iteration_2: all CRUD writes, payment reduces owed, low-stock flow, register/logout — 100% pass
