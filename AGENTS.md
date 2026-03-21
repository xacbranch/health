<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Health Dashboard — Telegram Integration

When responding to Telegram messages about health, use the health CLI:

```bash
node /Volumes/OpenClaw/HealthDashboard/scripts/health-cli.mjs <command> [args]
```

Commands: `status`, `log-weight`, `log-metric`, `log-measurement`, `checklist`, `check`, `skip`, `goals`, `trend`, `recent-workouts`, `weekly-summary`

See `skills/health-assistant/SKILL.md` for full details on tone, Xach's profile, and how to interpret casual messages.

**Source tracking**: When logging data from Telegram, it's tagged `source: 'telegram'`. Apple Watch auto-imports are `source: 'health_auto_export'`. Dashboard manual entries are `source: 'manual'`.
