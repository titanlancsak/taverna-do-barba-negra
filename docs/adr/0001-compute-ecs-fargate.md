# ADR 0001 — Compute: ECS Fargate

**Status:** aceito · **Contexto:** migração da VM única para a AWS.

## Contexto

A aplicação rodava numa VM (Rocky Linux) com PM2 + Nginx + PostgreSQL local.
Para o deploy na AWS, as opções eram EC2 (uma VM gerenciada), ECS no EC2
(containers em instâncias próprias) ou ECS Fargate (containers serverless).

## Decisão

Usar **ECS Fargate**. O container empacota o backend Node (Express + Socket.io)
e serve também o frontend estático (papel que era do Nginx). O ALB encaminha o
tráfego diretamente para as tasks.

## Consequências

- **Prós:** sem servidor para manter/patchear; escala horizontal trocando
  `desired_count`; deploy rolling nativo; integra bem com ECR + GitHub Actions.
- **Contras:** disco do container é efêmero — uploads e estado precisam sair do
  sistema de arquivos local (ver [ADR 0002](0002-uploads-efs.md) e
  [ADR 0003](0003-socketio-redis-rooms.md)); custo um pouco maior que um EC2
  pequeno.
- **Enxuto:** tasks em subnet pública com IP público dispensam o NAT Gateway.
