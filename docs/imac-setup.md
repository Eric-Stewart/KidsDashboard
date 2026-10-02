# iMac setup and manual refresh

The iMac collects school data using installed Google Chrome and uploads it to https://kidsdashboard-eight.vercel.app. The website and database stay hosted. You do not need Docker, a local database, or a local web server.

## Install once

1. Install Google Chrome and Node.js 24 LTS on the iMac.
2. Clone `https://github.com/Eric-Stewart/KidsDashboard.git`, or extract `KidsDashboard-iMac.zip`, into a permanent folder, for example `~/Applications/KidsDashboard`. Avoid moving it after installing the schedule.
3. In Terminal, run `cd ~/Applications/KidsDashboard` (adjust to your folder) and `chmod +x macos/*.command`. ZIP transfer may not preserve executable permissions.
4. Double-click `macos/Setup.command`. It installs the project dependencies, creates private configuration files if missing, and preserves existing values. If macOS asks to approve opening a downloaded file, review the file and use Finder's Open action; do not disable macOS security protections.
5. Fill in `.config` with the two Classroom accounts, Genesis parent login, and the two Genesis student IDs. Its dashboard URL already points to the live site. You can privately transfer the existing `.config` from your Windows computer, then run Setup again to apply Mac file permissions.
6. In `.env.local`, set `KIDS_DASHBOARD_INGEST_KEY` to the existing dashboard ingestion key from your private Windows `.env.local`. Retain `CLASSROOM_SOURCE=browser`. No parent OAuth, database, or cloud-refresh secrets are needed on the Mac collector. Do not share these files through chat or Git.

The portable ZIP deliberately excludes passwords, ingestion keys, database records, school records, installed dependencies and browser profiles. Finder shows hidden configuration files with Command–Shift–Period.

## Manual refresh

Double-click `macos/Refresh Now.command`. Chrome opens separate temporary sessions, reads visible school data, uploads it, and closes. Read the completion message; a failure for one connection does not mean other connections failed. Then open the website and select **Reload dashboard**. You do not need to type npm commands for subsequent refreshes.

The website's **Refresh schools** control still attempts the existing cloud collector. Genesis currently rejects the hosted browser, so use the Mac launcher for Genesis. **Reload dashboard** only retrieves already imported records; it does not sign into school websites or remotely start your Mac.

## Optional hourly schedule

After a successful manual refresh, double-click `macos/Enable Hourly Refresh.command`. It validates configuration and registers a per-user macOS LaunchAgent at the top of each hour. Chrome runs in your signed-in desktop session; keep the iMac awake, logged into macOS, and connected. This is not a system service running at the login screen. A missed calendar event while asleep can run when the Mac wakes. The installer records the current Node executable and project location; rerun it after moving the project or replacing Node.

Double-click `macos/Disable Hourly Refresh.command` to stop the schedule. Manual refresh remains available. Logs are in `~/Library/Logs/KidsDashboard/`. Only the installer on the iMac enables a schedule; preparing or downloading this package does not schedule anything.

If using your own scheduler, run the absolute path to Node with `--import tsx collector/run.ts` and set its working directory to the project folder. Do not schedule `Refresh Now.command`: that interactive launcher waits for Return after finishing. Run the job as your signed-in macOS user so Chrome can open.

An existing `.collector.lock` prevents overlapping manual and scheduled runs. If Chrome or the collector crashes, confirm the collector has stopped before removing that file. CAPTCHA, MFA, blocked access and unknown login providers stop collection; they are not bypassed. Previous records remain intact after a failed extraction. Classroom imports cover only observed work, not every collapsed or unvisited assignment.

This package is prepared on Windows. macOS installation and actual iMac school access must be verified on the iMac.

Reference: [Apple's timed launchd jobs](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/ScheduledJobs.html).
