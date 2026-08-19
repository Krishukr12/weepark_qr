# Manual Deployment — WeePark API

Local tests use Docker Postgres on port 5434. The deployed API uses Neon via `DATABASE_URL` in the env file. Do not copy `.env` into the image.

Replace `<KEY.pem>` if the SSH key path differs.

ECR (ap-south-1): `824033491309.dkr.ecr.ap-south-1.amazonaws.com/weepark-backend-qr`  
EC2 Elastic IP: `13.204.1.212`  
Public API: `https://api-qr.weepark.in`

Apply schema changes from your laptop against Neon **before** you ship a new image. The container only starts the API (`node dist/index.js`).

```bash
cd backend
pnpm exec prisma migrate deploy
```

---

## 1. Build Docker Image (Linux AMD64)

Run from the **repo root**.

```bash
docker buildx build \
  --platform linux/amd64 \
  --load \
  -f backend/Dockerfile \
  -t weepark-backend-qr:latest .
```

---

## 2. Tag Docker Image

```bash
docker tag weepark-backend-qr:latest \
824033491309.dkr.ecr.ap-south-1.amazonaws.com/weepark-backend-qr:latest
```

---

## 3. Login to Amazon ECR (Run only if login has expired)

```bash
aws ecr get-login-password \
  --region ap-south-1 \
  --profile weepark-client | \
docker login \
  --username AWS \
  --password-stdin 824033491309.dkr.ecr.ap-south-1.amazonaws.com
```

---

## 4. Push Image to ECR

```bash
docker push \
824033491309.dkr.ecr.ap-south-1.amazonaws.com/weepark-backend-qr:latest
```

---

## 5. SSH into Production Server

```bash
ssh -i /path/to/<KEY.pem> ubuntu@13.204.1.212
```

---

## 6. Login to Amazon ECR (EC2)

Use `sudo docker login` so credentials are stored for root. `sudo docker pull` / `sudo docker run` ignore the ubuntu user's `~/.docker/config.json`.

```bash
aws ecr get-login-password --region ap-south-1 | \
sudo docker login \
--username AWS \
--password-stdin 824033491309.dkr.ecr.ap-south-1.amazonaws.com
```

---

## 7. Pull Latest Docker Image

```bash
sudo docker pull \
824033491309.dkr.ecr.ap-south-1.amazonaws.com/weepark-backend-qr:latest
```

---

## 8. Stop Existing Container

```bash
sudo docker stop weepark-backend-qr
```

---

## 9. Remove Existing Container

```bash
sudo docker rm weepark-backend-qr
```

---

## 10. Start New Container

Env file on the server: `/opt/weepark/backend/.env`  
Must include Neon `DATABASE_URL`, JWT secrets, `API_URL=https://api-qr.weepark.in`, `CLIENT_URL` (the frontend origin), and `NODE_ENV=production`.

```bash
sudo docker run -d \
  --name weepark-backend-qr \
  --restart unless-stopped \
  --env-file /opt/weepark/backend/.env \
  -p 4000:4000 \
  824033491309.dkr.ecr.ap-south-1.amazonaws.com/weepark-backend-qr:latest
```

Local check (no ECR), from the repo root:

```bash
docker run -d \
  --name weepark-backend-qr \
  --env-file backend/.env \
  -p 4000:4000 \
  weepark-backend-qr:latest
```

---

## 11. Verify Running Containers

```bash
sudo docker ps
```

---

## 12. Check Application Logs

```bash
sudo docker logs --tail 100 weepark-backend-qr
```

---

## 13. Verify Local Health Endpoint

```bash
curl http://localhost:4000/health
```

Expected response:

```json
{"status":"ok","db":"up"}
```

---

## 14. Verify Production Health Endpoint

```bash
curl https://api-qr.weepark.in/health
```

Expected response:

```json
{"status":"ok","db":"up"}
```

---

## 15. Verify Nginx Configuration (If Modified)

```bash
sudo nginx -t
```

---

## 16. Reload Nginx (If Configuration Changed)

```bash
sudo systemctl reload nginx
```

---

## 17. Check Nginx Logs (Optional)

Access logs

```bash
sudo tail -f /var/log/nginx/access.log
```

Error logs

```bash
sudo tail -f /var/log/nginx/error.log
```

---

## 18. Docker Cleanup (Optional)

Remove unused images

```bash
sudo docker image prune -a -f
```

Check Docker disk usage

```bash
sudo docker system df
```

---

# Deployment Flow

```
Local Development
        |
        v
Build Docker Image
        |
        v
Push Image to Amazon ECR
        |
        v
SSH into EC2
        |
        v
Pull Latest Image
        |
        v
Stop Existing Container
        |
        v
Remove Existing Container
        |
        v
Start New Container (--env-file)
        |
        v
Verify Logs
        |
        v
Verify Health Endpoint
        |
        v
Production Live
```
