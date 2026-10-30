# ADR 0002 — Uploads de mídia no EFS

**Status:** aceito · **Contexto:** containers efêmeros no Fargate.

## Contexto

Fotos e vídeos (perfil, chat, feed, eventos) eram gravados no disco local em
`frontend/assets/*-media` por `sharp`/`ffmpeg` e servidos pelo Nginx. Em
container, o disco some a cada deploy, e com múltiplas instâncias um upload feito
numa task não existe nas outras.

## Decisão

Montar um volume **EFS** em `/data/media`, compartilhado por todas as tasks. O
código passou a usar a variável `MEDIA_ROOT` (padrão `frontend/assets` em
local/VM; `/data/media` em produção), então a gravação muda de destino sem
reescrever a lógica de upload. O Express serve `/assets/<tipo>-media` a partir
do EFS.

Alternativa considerada: **S3 + CloudFront**. Mais "cloud-native" e com CDN, mas
exigiria reescrever os 5 pontos de upload e a forma de servir os arquivos.

## Consequências

- **Prós:** migração sem reescrever o upload; persistente e compartilhado;
  continua funcionando igual em dev (fallback para `frontend/assets`).
- **Contras:** EFS tem latência e custo por GB maiores que disco local
  (desprezível no volume atual).
- **Evolução futura:** migrar para **S3 + CloudFront** para offload de banda e
  CDN global — caminho documentado, não bloqueante.
