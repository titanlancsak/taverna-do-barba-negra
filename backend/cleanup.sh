#!/bin/bash
# Remove arquivos temporários com mais de 1 hora nas pastas uploads e converted

UPLOADS_DIR="/var/www/taverna-do-barba-negra/backend/uploads"
CONVERTED_DIR="/var/www/taverna-do-barba-negra/backend/converted"

find "$UPLOADS_DIR" -type f -mmin +60 -delete
find "$CONVERTED_DIR" -type f -mmin +60 -delete

echo "$(date): Cleanup executed" >> /var/www/taverna-do-barba-negra/backend/cleanup.log
