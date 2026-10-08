# Gmail and email-client acceptance protocol

Automated tests prove that the app generates valid, email-safe HTML, refuses to copy unverified images, and puts rich HTML on the clipboard. They **cannot** prove that a real Gmail account accepts the paste or that a recipient's email app displays the result. Those checks are manual. This protocol defines them, and the results table below must be filled in **only** by someone who actually performed the test.

## Preconditions

* The image Worker is deployed on a public HTTPS domain, and its address and upload key are set in Settings.
* A production build is used (**not** `VITE_TEST_HOST=1`).
* Test accounts are available: one Gmail account (web), one Outlook (desktop or web) recipient, and one Apple Mail recipient (macOS or iOS).

## Steps

| # | Check | How |
|---|---|---|
| 1 | New signature can be copied into Gmail | Create a signature from **Boardroom** → Install → Copy Full → paste into Gmail → Settings → Signature → Create new |
| 2 | Built-in logo displays in a received email | Use the MG monogram logo, then send to an external address |
| 3 | Custom logo displays in a received email | Upload a PNG logo, crop it, install, then send |
| 4 | Social icons work | Add Instagram and LinkedIn with the circle style, send, then click each icon in the received email |
| 5 | Full and Reply variants behave correctly | Install both and set the defaults (New → Full, Reply → Reply). Compose a new email, then reply to it |
| 6 | Gmail defaults can be selected per send-as address | Account with 2+ send-as addresses: set the defaults for each |
| 7 | External image URLs remain accessible | Open each image URL in a private window with no login after 24 hours and after 7 days |
| 8 | Outlook and Apple Mail display acceptably | Send to the Outlook and Apple Mail recipients, then compare against the PNG export |
| 9 | Failed operations do not report success | Remove the host address in Settings and try Install. Copy must be blocked with a clear message |
| 10 | Existing project data remains intact | Reload, re-open the project, then export and re-import the project file. The content must be identical |

## Results

| # | Date | Tester | Client / version | Result | Notes / evidence |
|---|---|---|---|---|---|
| 1–10 | — | — | — | **Not yet performed** | Requires a deployed Worker and real accounts |

## Automated evidence already collected (development environment)

These were run with the local **test** image host, which simulates a public host on `localhost`, in headless Chromium. They are integration tests, not live Gmail tests.

* Images block copying until published: copy is disabled when no host is configured, and enabled after publish and verify.
* The built-in logo is derived (tinted SVG → 2× PNG), uploaded by content hash, fetched back anonymously (HTTP 200, `image/png`, decodes), and referenced in the copied HTML.
* An uploaded PNG logo goes through crop → publish → readiness.
* A text-only signature copies as `text/html` with `mailto:` links, no images and no editor attributes.
