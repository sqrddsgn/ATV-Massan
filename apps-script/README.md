# Exhibitor form -> Google Sheet

The form on `utstallare.html` posts to a small Google Apps Script web app, which appends one row per
application to a Google Sheet (and emails a copy to `NOTIFY_EMAIL`).

## One-time setup (about 5 minutes)

1. Create a new Google Sheet, e.g. **ATV-Mässan – utställaranmälningar**.
2. In the sheet: **Extensions -> Apps Script**. Replace the contents of `Code.gs` with the file in this folder and save.
3. Select the `setup` function in the toolbar and click **Run**. Approve the permissions
   (Google shows an "unverified app" warning for your own script: **Advanced -> Go to ... (unsafe)**).
   This creates the `Anmälningar` tab with the header row.
4. **Deploy -> New deployment -> Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy** and copy the **Web app URL** (ends in `/exec`).
5. Open `utstallare.html` and paste the URL into `window.ATV_FORM_ENDPOINT = '';`, then commit and push.

Opening the `/exec` URL in a browser should show `{"ok":true,...}`.

## Notes

- After editing `Code.gs`, use **Deploy -> Manage deployments -> Edit -> New version** so the live URL picks up the change.
- Set `NOTIFY_EMAIL` to `''` in `Code.gs` if you don't want an email per application.
- The fee is calculated from the chosen turnover band in the script, not trusted from the browser.
- Anyone with the web app URL can post to it. A hidden honeypot field and server-side validation
  filter most junk; check the sheet occasionally.
- Phone and organisation-number cells are stored as plain text so leading zeros are kept. Rows saved before this change may have lost the zero; retype them (or set the column format to "Plain text" first).
