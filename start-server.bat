@echo off
set DATABASE_URL=mysql://mysql:TB1vLHI7A3zYxakBjqHgmv3g2lwP6CBK0TA2tFQ1q70kg0DzoiluzSjHiVaM8NyC@192.168.1.202:9754/default
set PORT=3001
set APP_ORIGIN=http://localhost:5173
set NODE_ENV=development
set SEED_ADMIN_PASSWORD=Admin123!@#$%%
set SEED_STAFF_PASSWORD=Staff123!@#$%%
set SEED_DRIVER_PASSWORD=Driver123!@#$%%
set GCS_BUCKET=hr-deck
set GCS_KEY_FILE=C:\Users\IT SUPPORT ASM\gcs-keys\tugasgo-key.json
npx concurrently -n API,WEB -c green,cyan "node server/app.mjs" "npx vite --host 0.0.0.0"
