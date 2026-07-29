export const SERVER_PORT = 3080;
export const DEFAULT_ADMIN_PASS = 'vms';
export const SESSION_SECRET = process.env.SESSION_SECRET ?? 'capybara';
export const KIOSK_SECRET = process.env.KIOSK_SECRET ?? 'dev-kiosk-secret';

// ── GymMaster training sync ─────────────────────────────────────────────────
// API key is injected from the environment (Ansible vault → systemd env).
// No dev fallback: the sync route refuses to run without a real key rather
// than silently calling GymMaster unauthenticated.
export const GYMMASTER_API_KEY = process.env.GYMMASTER_API_KEY ?? '';

// Base includes the /api/v3 prefix; the route appends /member/?...
export const GYMMASTER_BASE_URL =
  process.env.GYMMASTER_BASE_URL ?? 'https://makespace.gymmasteronline.com/api/v3';

// Single-tool trial: maps the example tool's DB id to its GymMaster label.
// A label grants a subset of tools, so when generalizing beyond the trial,
// move this onto the Tools row (a labelId column) instead of config.
export const TRAINING_TOOL_ID = Number(process.env.TRAINING_TOOL_ID ?? '1');   // DB Tools.id
export const TRAINING_LABEL_ID = Number(process.env.TRAINING_LABEL_ID ?? '134172'); // GymMaster labelids tag
