# Windows 11 setup (PowerShell)

Run these in **PowerShell** from the repo folder. They generate the lockfile, run all checks, and commit the lockfile so CI's `npm ci` works.

## Prerequisites

- Node.js 20 LTS — check with:
  ```powershell
  node --version   # should print v20.x
  npm --version
  ```
  If missing, install with winget: `winget install OpenJS.NodeJS.LTS`

## 1. Generate the lockfile and run all checks

```powershell
cd path\to\service360-edu

npm install          # resolves dependencies and writes package-lock.json
npm run lint
npm run typecheck
npm run test
npm run build
```

All five should succeed. (Tests mock the AI, so no API key is needed to run them.)

## 2. Commit the lockfile (restores reproducible `npm ci` in CI)

CI is already set to `npm ci`, which needs this file committed:

```powershell
git add package-lock.json
git commit -m "chore: add package-lock.json for reproducible installs"
```

After this commit exists, `npm ci` in GitHub Actions will work on the first push.

## 3. (Optional) Run the app locally

Create `.env.local` with your own values (never commit it):

```powershell
Copy-Item .env.example .env.local
notepad .env.local   # fill in the four values
```

Then:

```powershell
npm run dev          # http://localhost:3000
```

- Report a fault: `http://localhost:3000/report?room=gx-summit-boardroom`
- Dashboard: `http://localhost:3000/dashboard` (sign in at `/login`)

## Notes

- To set an env var for a single PowerShell session instead of `.env.local`:
  ```powershell
  $env:ANTHROPIC_API_KEY = "sk-ant-..."
  ```
  (This lasts only for the current terminal session.)
- To chain commands in PowerShell, use `;` (not `&&`), e.g. `npm run lint; npm run test`.
