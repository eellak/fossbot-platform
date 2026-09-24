# Landing media candidates

Working set for homepage and marketing use. Every still has a 1280x720 and a 1920x1080 capture
unless noted. Nothing here is referenced by the app except the four images the homepage currently
uses (`python-editor`, `stage-builder`, `student-lesson`, `buddy-panel`).

Capture variants:

- `*-720p.png`: 1280x720 viewport, 1x scale. Large UI, used for small homepage slots.
- `*-1080p.png`: 1920x1080 viewport, 1x scale. Full-width desktop layout.
- `*-zoom.png`: 1440x810 viewport at 1.3333 scale, output 1920x1080. Desktop layout with
  larger UI; used for the large homepage slots so screenshots stay sharp and readable.

## Stills

| File | Surface | Notes |
| --- | --- | --- |
| `python-editor-720p/1080p.png`, `python-editor-zoom.png` | Python editor | Code, simulator, and terminal in one workspace. Used on the homepage. |
| `blockly-720p/1080p.png` | Blockly editor | Visual programming workspace. |
| `blockly-movement-720p/1080p.png` | Blockly editor | Movement category open. |
| `stage-builder-720p/1080p.png`, `stage-builder-zoom.png` | Stage Builder | Object library, 3D canvas, and inspector. Used on the homepage. |
| `student-lesson-720p/1080p.png`, `student-lesson-zoom.png` | Student lesson preview | Instructions, question, code, and simulation. Used on the homepage. |
| `buddy-panel-720p/1080p.png`, `buddy-panel-zoom.png` | FOSSBot Buddy | Conversation and review flow beside the Python workspace. Used on the homepage. |
| `course-authoring-720p/1080p.png` | Course authoring | Lesson structure and editor. |
| `course-library-720p/1080p.png` | Courses / Explore | Empty in the local seed data; replace when published courses exist. |
| `dashboard-720p/1080p.png` | Dashboard | Course and project collections. |
| `interactive-720p/1080p.png` | Interactive Mode | Simulator with gesture-mode explanation. Camera disconnected locally. |
| `rc-720p/1080p.png` | RC Mode | Simulator with game-controller and keyboard controls. |
| `homepage-hero-720p/1080p.png` | Landing page | Current hero render. |

## Motion

| File | Size | Notes |
| --- | --- | --- |
| `python-run-720p.webm` | 1280x720, ~14s | Full Python editor run: click Run, program executes. |
| `python-run-sim-720p.gif` | 640x480, ~9s | Cropped simulator view of the robot searching for the gem. |
| `stage-builder-orbit-720p.webm` | 1280x720, ~129s | Raw stage-builder camera orbit recording. |
| `stage-builder-orbit-720p.gif` | 720x405, ~8s | Trimmed stage-builder camera orbit. |
| `homepage-logo-wall-720p.webm` | 1280x720, ~14s | Raw hero logo-wall recording. |
| `homepage-logo-wall-720p-trimmed.webm` | 1280x720, ~6s | Trimmed hero logo-wall recording. |
| `homepage-logo-wall.gif` | 552x440, ~6s | Logo-wall GIF (6.3 MB; prefer the webm on the page). |

All captures were taken from the local development instance, light theme, English, at the
indicated viewport. Re-capture dark-theme or Greek variants when a use needs them.
