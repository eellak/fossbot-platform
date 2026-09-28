# Production HTTPS renewal

The host's `certbot.timer` renews `fossbot.gr`. Nginx serves HTTP-01
challenges from `/var/www/certbot`, shared read-only with `fsbt-front`.
Certificate directories are mounted instead of individual files so updated
Certbot symlinks are visible inside the container.

For an existing certificate installation:

1. Back up the production Compose file, Nginx configuration and
   `/etc/letsencrypt/renewal/fossbot.gr.conf`.
2. Create `/var/www/certbot/.well-known/acme-challenge` (mode 755), deploy
   the repository's Compose/Nginx configuration, and recreate only the frontend:
   `docker compose -f docker-compose-production.yml up -d --no-deps --no-build frontend`.
3. Install `reload-fossbot-nginx` as an executable root-owned file at
   `/etc/letsencrypt/renewal-hooks/deploy/reload-fossbot-nginx`.
4. On Certbot 2.1 (without `reconfigure`), update the backed-up renewal
   configuration under `[renewalparams]` to `authenticator = webroot` and
   `webroot_path = /var/www/certbot`, with a `[[webroot_map]]` subsection
   containing `fossbot.gr = /var/www/certbot`. Preserve other settings.
5. Test the saved configuration:
   `certbot renew --cert-name fossbot.gr --dry-run --no-random-sleep-on-renew`.
   Certbot 2.1 does not support `--run-deploy-hooks`; test the hook separately
   as root with the current production certificate:
   `RENEWED_LINEAGE=/etc/letsencrypt/live/fossbot.gr /etc/letsencrypt/renewal-hooks/deploy/reload-fossbot-nginx`.
6. Run `systemctl enable --now certbot.timer` and verify public HTTPS.

Inspect `journalctl -u certbot.service` and `/var/log/letsencrypt/letsencrypt.log`
for renewal failures. A successful timer run can mean the certificate was not
yet due; the dry run validates the actual renewal path. No frontend rebuild
or backend/database restart is needed for certificate renewals.
