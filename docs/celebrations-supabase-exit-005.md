# CELEBRATIONS-SUPABASE-EXIT-005 — real Cloudflare staging deployment

## Independent access audit
- Repository branch HEAD at start: b2c4c9955a13685d1067c7e2cce89a3a970305b2.
- Existing workflows include GitHub Pages production deployment on main, R2 controlled sync and isolated staging tests. None previously deployed the D1/R2 Worker staging site.
- GitHub connector exposes repository files and Actions runs, **not** the Actions secrets/variables inventory. The GitHub public-fetch endpoint rejects Actions secrets and variables paths. Their presence cannot be verified from this session.
- No connected Cloudflare account administration API is available here. An existing R2 object-access key is NOT proof of Workers/D1 administration permission.
- Consequently, **no real Cloudflare deployment was attempted**, and no existing bucket or D1 identifier was guessed.

## Prepared staging deployment
- Workflow: .github/workflows/celebrations-staging-deploy.yml
- Manual only, exact branch + confirmation DEPLOY_STAGING, read-only GitHub permission, dedicated staging environment, concurrency lock.
- Requires staging-only Cloudflare API token, account ID, D1 database ID, private R2 bucket name, and separate staging admin PBKDF2 hash/salt.
- Explicit R2 bucket guard: celebrations-exit-staging; generated Worker name and D1 database name: celebrations-exit-staging.
- Builds static assets, creates D1 schema and media ACL tables on remote D1, configures admin Worker secrets and deploys Worker using Wrangler 4.
- Does **not** create Cloudflare D1 or R2 resources: their identifiers and existence must be verified first. Does not import real Supabase data or private PDFs.
- No production routes, main branch, DNS, production D1/R2 or Supabase data are changed.

## Minimal human intervention

1. Open Cloudflare Dashboard, select the intended account and check free-tier limits before proceeding. Under **Workers & Pages → D1 SQL database**, create a **new** D1 database named `celebrations-exit-staging`. Record its database UUID. Under **R2 Object Storage**, create a **new, private** bucket named `celebrations-exit-staging`. Do **not** enable public access, a custom domain, or any paid option. If a staging resource already exists, verify its name, ownership and isolation before reusing it.
2. In **Cloudflare → My Profile → API Tokens → Create Token**, create a **dedicated, limited-scope token** for this account. Needed permissions: **Account → Workers Scripts → Edit**, **Account → D1 → Edit**, **Account → Workers R2 Storage → Edit** (permission naming varies in Cloudflare UI; select the narrowest equivalent). If Cloudflare requires **Account → Workers Routes → Edit** for the chosen deployment, grant it only if explicitly requested by the platform; the staging workflow uses workers.dev and does not create routes or DNS. Do not use an R2 S3 object-access key in place of this token. Never paste the token in ChatGPT.
3. In GitHub repository **Settings → Environments**, create `celebrations-staging`. Configure a branch restriction to `feat/celebrations-supabase-exit-001`; optionally require human review for deployments.
4. In **GitHub repository Settings → Secrets and variables → Actions → Variables** (or corresponding staging environment variables), set `CELEBRATIONS_STAGING_CF_ACCOUNT_ID` to the Cloudflare account ID, `CELEBRATIONS_STAGING_D1_ID` to the new D1 UUID, and `CELEBRATIONS_STAGING_R2_BUCKET` to exactly `celebrations-exit-staging`.
5. In the same **Actions → Secrets** (or corresponding staging environment secrets), set `CELEBRATIONS_STAGING_CF_API_TOKEN` to the dedicated Cloudflare API token. Add `CELEBRATIONS_STAGING_ADMIN_PASSWORD_HASH` and `CELEBRATIONS_STAGING_ADMIN_PASSWORD_SALT` generated **locally** for a distinct staging-only password using the PBKDF2 algorithm in migration/cloudflare/auth-api.mjs (SHA-256, 180000 iterations, UTF-8 salt string). Never reuse or paste the production password or password hash. Store only derived hash/salt in GitHub.
6. **Important GitHub limitation:** GitHub normally registers workflow_dispatch workflows only after the workflow exists on the repository default branch. This staging workflow exists on the feature branch, so the **Run workflow** button may not appear yet. Do **not** merge or copy it to main without Grand-père's authorization. If unavailable, the precise remaining blocker is enabling manual dispatch safely while preserving production isolation.
7. Once the workflow is dispatchable, select branch `feat/celebrations-supabase-exit-001`, enter `DEPLOY_STAGING`, then run. Check the Actions run and Cloudflare deployment URL. A success result only proves deployment, not full app usability.
8. After deployment, test GET /api/public-data (with required query parameters), GET /?staging=1, GET /admin.html?staging=1, unauthorized admin mutation rejection, synthetic participant login, synthetic content CRUD, synthetic R2 upload/read/revocation, and real browser audio/PDF behavior. Use only synthetic test data and no private Supabase export.

## Not yet verified
- Cloudflare API token/permissions, account ID, staging D1 and R2 existence.
- Manual dispatch visibility on feature branch.
- Real deployment, URL, remote schema execution, secrets setup, live HTTP endpoints and browser.
- Cloudflare quota/cost availability.
- The production-independent completeness of the application (separate known issue from EXIT-004).

DEPLOYMENT_METHOD=GitHub Actions manual + Wrangler 4
CLOUDFLARE_ACCESS=NOT VERIFIED (connector missing; GitHub secrets inventory inaccessible)
STAGING_URL=NONE VERIFIED
D1_STAGING=NOT VERIFIED
R2_STAGING=NOT VERIFIED
REAL_HTTP_TESTS=NOT RUN
REAL_BROWSER_TESTS=NOT RUN
READY_FOR_PRODUCTION=NO
READY_TO_CANCEL_SUPABASE_PRO=NO
