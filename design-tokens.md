---
name: mybookcms-storefront
description: Restrained product-first public storefront tokens for MyBookCMS
theme:
  default: light
  dark: out-of-scope
  white-temperature: neutral
---

# MyBookCMS Storefront Tokens

> Verified against disk: 2026-09-04 @ MyBookCMS working tree

Public presentation is calm, legible, and product-first. Customer-facing copy
must work in Malay and English; prices render as MYR. The operator admin uses
its own Indonesian-oriented system and is not governed by these storefront
tokens.

## Core tokens

| Token | Value | Use |
| --- | --- | --- |
| Surface | `#ffffff` | Page and card background |
| Ink | `#111111` | Primary text and controls |
| Muted text | `#555555` | Supporting text |
| Muted control | `#767676` | Control borders and secondary control text; clears the 3:1 non-text contrast floor |
| Line | `#e5e5e5` | Borders and dividers |
| Radius | `0.5rem` | Inputs and lightweight cards |

Use semantic HTML, visible focus, 44px minimum touch targets, and 16px mobile
input text. Do not use a payment or logistics-provider brand as a system accent.

`DESIGN-SYSTEM.md` carries the complete storefront palette, including the accent,
warm canvas, and error roles this shorter table omits. Where the two disagree,
the stylesheet in `src/styles/` settles it.
