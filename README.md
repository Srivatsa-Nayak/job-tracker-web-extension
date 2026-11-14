# Job Tracker

A Chrome extension that searches jobs, tracks your applications, and fills application forms with your profile and
resume. There is no server and no website to run: everything, including your data, stays inside the extension in your
browser.

## Install

1. Build the app into the extension (once, and again after any code change):

   ```bash
   cd web
   npm install
   npm run build:ext
   ```

2. In Chrome, open `chrome://extensions` and turn on **Developer mode**.
3. Choose **Load unpacked** and pick this project's `extension` folder.

Job Tracker opens in a tab, on the Profile page. To come back to it later, click the extension's icon and choose
**Open Job Tracker**. After rebuilding, press the reload arrow on the extension's card in `chrome://extensions`.

## Use it

1. **Profile**: fill in your details and add your resume. This is what gets typed into forms.
2. **Jobs**: search, filter, and click **Apply**. The application page opens in a new tab and the job is marked as
   applied in your tracker (there is an Undo).
3. On the application page the form is filled in and your resume attached:
   - Greenhouse, Lever, Ashby, Workday, SmartRecruiters and Workable fill in by themselves when the page opens. This
     can be turned off in the extension's popup.
   - On any other site, press **Alt+Shift+F**, or click the extension icon and choose **Fill this page**.
   - Filled fields get a yellow outline. Required fields it could not answer get a red outline.
4. Check the form and press Submit yourself. The extension never submits for you.
5. **Tracker**: drag jobs between Saved, Applied, Interviewing, Offer and Rejected, and keep notes.

To see autofill work without a real application, open **Settings**, then **Try it on a sample form**.

Autofill does not run on LinkedIn. Automating LinkedIn breaks its terms and can get an account restricted, so
applications that live on LinkedIn are filled in by hand.

## Where the jobs come from

LinkedIn has no public jobs API. Listings from LinkedIn, Indeed, Glassdoor and other boards come through
[JSearch](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch), which needs a free RapidAPI key:

1. Create a free RapidAPI account, open JSearch and subscribe to the free Basic plan.
2. Give the app the key in one of two ways:
   - paste it under **Settings** in the app, or
   - copy `web/.env.example` to `web/.env.local`, put the key there, and rebuild. The app then has it built in.

Without a key the app shows jobs from Remotive (remote roles) and Arbeitnow (mostly Germany and remote). JSearch only
runs when you type a search. The free plan has a monthly request limit, so results are kept for the browser session
instead of being fetched again.

A key in `web/.env.local` ends up inside `extension/app/`. Both are ignored by git; do not share that folder or
publish the extension with your key in it.

## What to expect

- Autofill matches fields by their labels. Standard questions (name, contact details, links, experience, notice
  period, salary, sponsorship, cover letter, resume) are filled; custom questions are left for you.
- Multi-step forms such as Workday are filled step by step as each step appears, for about a minute after the page
  opens. Press Alt+Shift+F again on later steps if needed.
- Your profile, resume and tracker live in the extension's own storage. Removing the extension deletes them, so use
  **Settings**, then **Download backup** first.

## Develop

The app can also run as a normal page with hot reload:

```bash
cd web
npm run dev
```

Open http://localhost:5173. With the extension installed, this page hands your profile to it as well, but it keeps
its own separate copy of your data from the one inside the extension.

```bash
npm test        # unit tests: job-source mapping, filters, autofill field matching
npm run lint
```

| Path | What it holds |
| --- | --- |
| `web/src/api/` | One file per job source, plus merging and caching |
| `web/src/store/` | Saved state: tracker, profile, resume, settings |
| `web/src/lib/extensionBridge.ts` | Hands the profile and resume to the autofill scripts |
| `extension/app/` | The built app (created by `npm run build:ext`) |
| `extension/content/fieldMap.js` | Rules that decide which profile field goes in a form control |
| `extension/content/autofill.js` | Fills the form and attaches the resume |
| `extension/background.js` | Opens the app, runs a fill on request |
| `extension/popup/` | The small window behind the extension icon |
