# VidNova — YouTube-style video sharing starter

A beginner-friendly starter built with HTML, CSS, JavaScript and Supabase. It includes a responsive video feed, search, categories, email sign-up/sign-in, video uploads (Long videos and Shorts), video playback, likes, comments, subscription videos, and a user's own video list. The bottom navigation has redesigned Home/You icons and a Shorts tab.

## Important: what this is (and isn't)
This is a starter project, not a production YouTube clone. It does not include video transcoding/adaptive streaming, moderation tools, copyright detection, creator monetization, live streaming, recommendation algorithms, push notifications, or abuse prevention. A public video platform needs moderation, reporting, takedown handling, rate limits, and more security review before launch.

## Files
- `index.html` — app UI
- `style.css` — responsive dark UI
- `app.js` — front-end and Supabase calls
- `supabase_setup.sql` — database schema, row-level security policies, and video storage setup
- `netlify.toml` — static-hosting headers/SPA fallback
- `vercel.json` — static-hosting config
- `README.md` — these instructions

## A. Run the interface immediately
1. Extract the ZIP.
2. Open `index.html` in a browser. The demo cards and sample video are shown.
3. In demo mode, login/upload/like/comment/subscribe cannot be saved. This is expected.

## B. Connect real users and uploads (free-tier start)
1. Create a project at https://supabase.com/ and open its Dashboard.
2. Open **SQL Editor -> New query**.
3. Paste the entire `supabase_setup.sql` file and run it.
4. Open **Project Settings -> API** (or Connect/API keys, depending on the dashboard).
5. Copy the Project URL and the `anon` / publishable public key. Never use `service_role` or secret keys in browser code.
6. Open `app.js`. Replace:
   - `PASTE_YOUR_SUPABASE_PROJECT_URL_HERE`
   - `PASTE_YOUR_SUPABASE_ANON_PUBLIC_KEY_HERE`
7. In Supabase Authentication settings, configure the Site URL and allowed redirect URLs for your local/hosted app. For testing, you can turn email confirmation off, or leave it on and confirm the sign-up email.
8. Serve the folder from a local web server or deploy it to a static host over HTTPS. For example, with Node installed: `npx serve .` then open the local URL. Avoid opening as `file://` if authentication/CORS gives issues.
9. Create a test account, sign in, upload a small MP4, then try Like, Comment, Subscribe, and upload a Long video or a Short using the Video type selector. If you already ran an older version of the SQL, run the updated `supabase_setup.sql` again to add the `video_type` column.

The SQL attempts to create the public `videos` Storage bucket and security policies. If Supabase rejects Storage statements due to project permissions, create a public bucket named `videos` in Storage with a 100 MB file limit and allowed types MP4, WebM, MOV, then apply the storage policies in the SQL file via the SQL Editor or Storage policies UI.

## Free-tier and video storage notes
Supabase free-plan quotas and product policies can change. Free tiers have storage, bandwidth/egress, and database limits; video files can use these up quickly. Start with small test clips. Public bucket videos are public to anyone who has the URL. Do not upload private or copyrighted videos without permission. For larger usage, use a dedicated video service (for example, Cloudflare Stream, Mux, or another provider) and check current pricing before choosing one. Do not assume unlimited free video hosting.

## C. Make an Android APK
HTML/CSS/JS is not itself an APK. The recommended route is Capacitor, typically using a computer:
1. Install Node.js LTS and Android Studio.
2. In a terminal, create a Capacitor app project and install packages:
   ```bash
   mkdir vidnova-mobile
   cd vidnova-mobile
   npm init -y
   npm install @capacitor/core @capacitor/cli @capacitor/android
   npx cap init VidNova com.example.vidnova
   ```
3. Configure Capacitor's `webDir` to a folder such as `www`, then copy this project's `index.html`, `style.css`, and `app.js` into `www/`. (Keep Supabase config in `app.js` as above.)
4. Add Android and sync:
   ```bash
   npx cap add android
   npx cap sync android
   npx cap open android
   ```
5. Build/test an APK in Android Studio. Follow the current Capacitor documentation if command prompts or project templates differ by version.

Note: Supabase's anon/publishable key is designed to be public when RLS is configured properly. Never place secret/service-role keys in a mobile app. For production, add stricter file validation, upload limits, abuse protection, reporting/moderation, and review all database/storage policies.

## Troubleshooting
- `Invalid API key`: make sure you used the anon/publishable public key, not a secret key.
- Sign-up succeeds but no login: check email confirmation and Auth URL settings.
- Upload permission denied: run SQL setup, confirm bucket name `videos`, and ensure you are signed in.
- Videos upload but don't appear: check browser console and the `videos` table in Supabase.
- Some browsers block local `file://` behavior: use a local server or HTTPS static host.
