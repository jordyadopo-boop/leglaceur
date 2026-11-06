# ECC (Everything Claude Code) — copie locale

Agents, skills et commandes copiés depuis le dépôt officiel https://github.com/affaan-m/ECC
(commit b38be6a7f6350964d59328b52f0624e1d1d552d1, licence MIT : voir ECC-LICENSE).

Pourquoi une copie ? Les sessions Claude Code sur le web et mobile n'installent pas les plugins
déclarés dans `.claude/settings.json`, mais elles chargent `.claude/agents/`, `.claude/skills/`
et `.claude/commands/`.

Renommés pour ne pas masquer les commandes intégrées de Claude Code :
- `/code-review` d'ECC -> `/ecc-code-review`
- `/plan` d'ECC -> `/ecc-plan`
- skill `security-review` d'ECC -> `ecc-security-review`

Limites : les hooks et serveurs MCP du plugin ne sont pas inclus, et une vingtaine de fichiers
qui utilisent `CLAUDE_PLUGIN_ROOT` (outils internes d'ECC) peuvent ne pas fonctionner.
