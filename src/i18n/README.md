# src/i18n — owner: ChatGPT/Codex

IT/EN translation tables. Translate every `MessageCode` in `src/core/messages.ts`: type the tables as `Record<MessageCode, (args) => string>` so a missing translation is a compile error. Other modules never contain user-facing text.
