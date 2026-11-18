#!/usr/bin/env bash
# One-time setup for a fresh Ubuntu 22.04/24.04 EC2 instance.
#
#   curl -fsSL https://raw.githubusercontent.com/<you>/ecom-autoparts/main/deploy/ec2/bootstrap.sh -o bootstrap.sh
#   sudo DOMAIN=shop.example.com bash bootstrap.sh
#
# It installs Docker + the compose plugin, Caddy (automatic HTTPS), a firewall,
# and swap, then points Caddy at the web container on 127.0.0.1:8080
# (see docker-compose.deploy.yml). After this, GitHub Actions does every deploy.
set -euo pipefail

: "${DOMAIN:?Set DOMAIN, e.g. sudo DOMAIN=shop.example.com bash bootstrap.sh}"
DEPLOY_USER="${DEPLOY_USER:-ubuntu}"
SWAP_SIZE="${SWAP_SIZE:-2G}"

if [ "$(id -u)" -ne 0 ]; then echo "Run as root (sudo)." >&2; exit 1; fi
id "$DEPLOY_USER" >/dev/null 2>&1 || { echo "User $DEPLOY_USER does not exist." >&2; exit 1; }

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg ufw unattended-upgrades debian-keyring debian-archive-keyring apt-transport-https

# --- Docker -----------------------------------------------------------------
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker
usermod -aG docker "$DEPLOY_USER"

# Keep container logs from filling the disk.
cat > /etc/docker/daemon.json <<'JSON'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
JSON
systemctl restart docker

# --- Caddy (TLS termination + reverse proxy) --------------------------------
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi
cat > /etc/caddy/Caddyfile <<CADDY
${DOMAIN} {
    encode gzip
    request_body {
        max_size 10MB
    }
    reverse_proxy 127.0.0.1:8080
}
CADDY
systemctl enable caddy
systemctl restart caddy

# --- Firewall (the EC2 security group should match) --------------------------
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# --- Swap (MongoDB + Node on a small instance) ------------------------------
if ! swapon --show | grep -q .; then
  fallocate -l "$SWAP_SIZE" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# --- Deploy directory -------------------------------------------------------
sudo -u "$DEPLOY_USER" mkdir -p "/home/$DEPLOY_USER/ecom-autoparts"

echo
echo "Done. Next:"
echo "  1. Point DNS A record for ${DOMAIN} at this instance's Elastic IP."
echo "  2. Add the GitHub secrets from DEPLOYMENT.md (EC2 section)."
echo "  3. Push to main (or run the CD workflow)."
