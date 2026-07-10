#!/usr/bin/env bash
# UnityCommit control script — start, stop, build, and manage the app.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

PID_DIR="$ROOT_DIR/.deploy"
DEV_PID_FILE="$PID_DIR/dev.pid"
PROD_PID_FILE="$PID_DIR/prod.pid"
DEV_LOG="$PID_DIR/dev.log"
PROD_LOG="$PID_DIR/prod.log"
PORT="${PORT:-3000}"

mkdir -p "$PID_DIR"

# ── helpers ──────────────────────────────────────────────────────────────────

c_reset='\033[0m'
c_bold='\033[1m'
c_dim='\033[2m'
c_green='\033[32m'
c_yellow='\033[33m'
c_red='\033[31m'
c_cyan='\033[36m'
c_gold='\033[38;5;178m'

info()  { printf "${c_cyan}ℹ${c_reset}  %s\n" "$*"; }
ok()    { printf "${c_green}✔${c_reset}  %s\n" "$*"; }
warn()  { printf "${c_yellow}⚠${c_reset}  %s\n" "$*"; }
err()   { printf "${c_red}✖${c_reset}  %s\n" "$*" >&2; }

pause() {
  echo
  read -r -p "Press Enter to continue…" _
}

require_node() {
  if ! command -v node >/dev/null 2>&1; then
    err "Node.js is not installed or not on PATH."
    return 1
  fi
  if ! command -v npm >/dev/null 2>&1; then
    err "npm is not installed or not on PATH."
    return 1
  fi
}

require_env() {
  if [[ ! -f "$ROOT_DIR/.env" ]]; then
    err "Missing .env file. Create one with DATABASE_URL before continuing."
    return 1
  fi
}

is_running() {
  local pid_file="$1"
  [[ -f "$pid_file" ]] || return 1
  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  [[ -n "${pid:-}" ]] || return 1
  if kill -0 "$pid" 2>/dev/null; then
    return 0
  fi
  # Stale pid file
  rm -f "$pid_file"
  return 1
}

pid_of() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    cat "$pid_file"
  fi
}

stop_process() {
  local label="$1"
  local pid_file="$2"
  if ! is_running "$pid_file"; then
    warn "$label is not running."
    return 0
  fi
  local pid
  pid="$(pid_of "$pid_file")"
  info "Stopping $label (pid $pid)…"
  kill "$pid" 2>/dev/null || true
  # Give it a moment, then force if needed
  for _ in 1 2 3 4 5; do
    if ! kill -0 "$pid" 2>/dev/null; then
      break
    fi
    sleep 0.4
  done
  if kill -0 "$pid" 2>/dev/null; then
    warn "Force-killing $label…"
    kill -9 "$pid" 2>/dev/null || true
  fi
  rm -f "$pid_file"
  ok "$label stopped."
}

start_background() {
  local label="$1"
  local pid_file="$2"
  local log_file="$3"
  shift 3

  if is_running "$pid_file"; then
    warn "$label is already running (pid $(pid_of "$pid_file"))."
    return 0
  fi

  info "Starting $label…"
  # Use nohup so the process survives closing the menu shell on Unix/Git Bash.
  nohup "$@" >"$log_file" 2>&1 &
  local pid=$!
  echo "$pid" >"$pid_file"
  sleep 1
  if kill -0 "$pid" 2>/dev/null; then
    ok "$label started (pid $pid)."
    info "Logs: $log_file"
    info "URL:  http://localhost:${PORT}"
  else
    err "$label failed to start. Check $log_file"
    rm -f "$pid_file"
    return 1
  fi
}

show_status() {
  echo
  printf "${c_bold}Status${c_reset}\n"
  printf "  Project:  %s\n" "$ROOT_DIR"
  printf "  Port:     %s\n" "$PORT"
  printf "  Node:     %s\n" "$(command -v node >/dev/null && node -v || echo 'not found')"
  printf "  npm:      %s\n" "$(command -v npm >/dev/null && npm -v || echo 'not found')"
  printf "  .env:     %s\n" "$([[ -f .env ]] && echo 'present' || echo 'MISSING')"
  printf "  node_modules: %s\n" "$([[ -d node_modules ]] && echo 'installed' || echo 'missing — run Install')"

  if is_running "$DEV_PID_FILE"; then
    printf "  Dev:      ${c_green}running${c_reset} (pid %s)\n" "$(pid_of "$DEV_PID_FILE")"
  else
    printf "  Dev:      ${c_dim}stopped${c_reset}\n"
  fi

  if is_running "$PROD_PID_FILE"; then
    printf "  Prod:     ${c_green}running${c_reset} (pid %s)\n" "$(pid_of "$PROD_PID_FILE")"
  else
    printf "  Prod:     ${c_dim}stopped${c_reset}\n"
  fi
  echo
}

tail_log() {
  local log_file="$1"
  local label="$2"
  if [[ ! -f "$log_file" ]]; then
    warn "No $label log yet."
    return 0
  fi
  info "Showing last 40 lines of $label log (Ctrl+C to stop live follow)…"
  echo "────────────────────────────────────────"
  tail -n 40 "$log_file" || true
  echo "────────────────────────────────────────"
  read -r -p "Follow live? [y/N] " follow
  if [[ "${follow:-}" =~ ^[Yy]$ ]]; then
    tail -f "$log_file"
  fi
}

# ── actions ──────────────────────────────────────────────────────────────────

do_install() {
  require_node || return 1
  info "Installing npm dependencies…"
  npm install
  ok "Dependencies installed."
}

do_db_setup() {
  require_node || return 1
  require_env || return 1
  if [[ ! -d node_modules ]]; then
    warn "node_modules missing — installing first…"
    npm install
  fi
  info "Running migrations + seed…"
  npm run db:setup
  ok "Database ready."
}

do_db_migrate() {
  require_node || return 1
  require_env || return 1
  npm run db:migrate
  ok "Migrations applied."
}

do_db_seed() {
  require_node || return 1
  require_env || return 1
  npm run db:seed
  ok "Seed data loaded."
}

do_start_dev() {
  require_node || return 1
  require_env || return 1
  if [[ ! -d node_modules ]]; then
    warn "Installing dependencies first…"
    npm install
  fi
  if is_running "$PROD_PID_FILE"; then
    warn "Production server is running. Stop it before starting dev, or use a different PORT."
  fi
  start_background "Dev server" "$DEV_PID_FILE" "$DEV_LOG" \
    npm run dev -- --port "$PORT"
}

do_start_prod() {
  require_node || return 1
  require_env || return 1
  if [[ ! -d .next ]]; then
    warn "No production build found. Building first…"
    npm run build
  fi
  if is_running "$DEV_PID_FILE"; then
    warn "Dev server is running. Stop it before starting production, or use a different PORT."
  fi
  start_background "Production server" "$PROD_PID_FILE" "$PROD_LOG" \
    npm run start -- --port "$PORT"
}

do_build() {
  require_node || return 1
  require_env || return 1
  if [[ ! -d node_modules ]]; then
    npm install
  fi
  info "Building production bundle…"
  npm run build
  ok "Build complete."
}

do_stop_dev() {
  stop_process "Dev server" "$DEV_PID_FILE"
}

do_stop_prod() {
  stop_process "Production server" "$PROD_PID_FILE"
}

do_stop_all() {
  do_stop_dev
  do_stop_prod
}

do_lint() {
  require_node || return 1
  npm run lint
}

do_open() {
  local url="http://localhost:${PORT}"
  info "Opening $url …"
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1 || true
  elif command -v open >/dev/null 2>&1; then
    open "$url" >/dev/null 2>&1 || true
  elif command -v cmd.exe >/dev/null 2>&1; then
    cmd.exe /c start "$url" >/dev/null 2>&1 || true
  else
    warn "Could not detect a browser opener. Visit: $url"
  fi
}

# ── menu ─────────────────────────────────────────────────────────────────────

print_banner() {
  clear 2>/dev/null || true
  printf "${c_gold}${c_bold}"
  cat <<'EOF'
╔══════════════════════════════════════════╗
║           UnityCommit Control            ║
║     Church Committee Workspace App       ║
╚══════════════════════════════════════════╝
EOF
  printf "${c_reset}"
  show_status
}

print_menu() {
  cat <<EOF
${c_bold}App${c_reset}
  1) Start development server
  2) Start production server
  3) Stop development server
  4) Stop production server
  5) Stop all servers
  6) Open app in browser

${c_bold}Build & deps${c_reset}
  7) Install dependencies (npm install)
  8) Build for production
  9) Lint

${c_bold}Database${c_reset}
 10) Full DB setup (migrate + seed)
 11) Run migrations only
 12) Seed database only

${c_bold}Logs & info${c_reset}
 13) View / follow dev logs
 14) View / follow prod logs
 15) Refresh status

  0) Exit
EOF
  echo
}

run_menu() {
  while true; do
    print_banner
    print_menu
    read -r -p "Select option: " choice
    echo
    case "${choice:-}" in
      1)  do_start_dev; pause ;;
      2)  do_start_prod; pause ;;
      3)  do_stop_dev; pause ;;
      4)  do_stop_prod; pause ;;
      5)  do_stop_all; pause ;;
      6)  do_open; pause ;;
      7)  do_install; pause ;;
      8)  do_build; pause ;;
      9)  do_lint; pause ;;
      10) do_db_setup; pause ;;
      11) do_db_migrate; pause ;;
      12) do_db_seed; pause ;;
      13) tail_log "$DEV_LOG" "dev"; pause ;;
      14) tail_log "$PROD_LOG" "prod"; pause ;;
      15) ;; # refresh on next loop
      0|q|Q|exit) ok "Goodbye."; exit 0 ;;
      *) err "Invalid option: ${choice:-}"; pause ;;
    esac
  done
}

# Direct CLI shortcuts: ./deploy.sh start | stop | status | …
usage() {
  cat <<EOF
Usage: ./deploy.sh [command]

Interactive menu (default):
  ./deploy.sh

Commands:
  start | start:dev     Start development server
  start:prod            Start production server
  stop | stop:dev       Stop development server
  stop:prod             Stop production server
  stop:all              Stop all servers
  build                 Production build
  install               npm install
  db:setup              Migrate + seed
  db:migrate            Migrate only
  db:seed               Seed only
  lint                  Run ESLint
  logs | logs:dev       Tail dev logs
  logs:prod             Tail prod logs
  status                Show status and exit
  open                  Open http://localhost:\$PORT
  help                  Show this help

Env:
  PORT=3000             Override listen port (default 3000)
EOF
}

main() {
  local cmd="${1:-}"
  case "$cmd" in
    "")           run_menu ;;
    start|start:dev) do_start_dev ;;
    start:prod)   do_start_prod ;;
    stop|stop:dev) do_stop_dev ;;
    stop:prod)    do_stop_prod ;;
    stop:all)     do_stop_all ;;
    build)        do_build ;;
    install)      do_install ;;
    db:setup)     do_db_setup ;;
    db:migrate)   do_db_migrate ;;
    db:seed)      do_db_seed ;;
    lint)         do_lint ;;
    logs|logs:dev) tail_log "$DEV_LOG" "dev" ;;
    logs:prod)    tail_log "$PROD_LOG" "prod" ;;
    status)       show_status ;;
    open)         do_open ;;
    help|-h|--help) usage ;;
    *)
      err "Unknown command: $cmd"
      usage
      exit 1
      ;;
  esac
}

main "$@"
