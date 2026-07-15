# Nginx Configuration Reference

This file documents the Nginx server block configuration used in production,
since `/etc/nginx/conf.d/taverna.conf` on the VM is not tracked by Git.

## Key additions

### Socket.io WebSocket proxying
Required for real-time chat to work. Without this block, Socket.io connections
fail with 404 errors because Nginx doesn't know how to proxy the `/socket.io/`
path or upgrade the connection to WebSocket.

```nginx
location /socket.io/ {
    proxy_pass http://localhost:3000/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### API proxying
```nginx
location /api/ {
    proxy_pass http://localhost:3000/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 20M;
}
```

## Notes
- SSL config is auto-managed by Certbot (Let's Encrypt), don't edit those blocks manually.
- `client_max_body_size 20M` is needed to allow media uploads (images/videos) through the proxy.
