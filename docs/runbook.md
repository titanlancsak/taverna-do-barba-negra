# Runbook operacional

Comandos do dia a dia do ambiente AWS. Região padrão: `ap-northeast-1`.
Nomes (`taverna`) seguem os defaults do Terraform.

## Deploy

Automático a cada `push` na `main`. Manual: aba **Actions → Deploy to AWS →
Run workflow**. O pipeline builda, migra e atualiza o service.

## Acompanhar um deploy

```bash
aws ecs describe-services --cluster taverna --services taverna \
  --query 'services[0].deployments'
```

## Logs

```bash
# últimos logs da aplicação
aws logs tail /ecs/taverna --follow
```
Ou CloudWatch → Log groups → `/ecs/taverna`. Métricas em Container Insights.

## Entrar no container (debug)

ECS Exec está habilitado:

```bash
TASK=$(aws ecs list-tasks --cluster taverna --service-name taverna \
  --query 'taskArns[0]' --output text)
aws ecs execute-command --cluster taverna --task "$TASK" \
  --container taverna --interactive --command "/bin/bash"
```

## Rodar migrações manualmente

Normalmente o CI roda. Para rodar à mão, use a mesma task one-off com override
`node db/migrate.js` (ver o passo "migrações" em `.github/workflows/deploy.yml`).

## Rollback

Volte o service para a revisão anterior da task definition:

```bash
aws ecs list-task-definitions --family-prefix taverna --sort DESC
aws ecs update-service --cluster taverna --service taverna \
  --task-definition taverna:<REVISÃO_ANTERIOR>
aws ecs wait services-stable --cluster taverna --services taverna
```
> Rollback reverte o código. Migrações de banco não são revertidas
> automaticamente — projete migrações compatíveis com a versão anterior.

## Escalar (demonstrar multi-instância)

```bash
# imediato
aws ecs update-service --cluster taverna --service taverna --desired-count 2
```
Para permanente, ajuste `desired_count` (e mantenha `enable_redis = true`) no
Terraform. Ver [ADR 0003](adr/0003-socketio-redis-rooms.md).

## Reduzir custo quando não estiver demonstrando

```bash
aws ecs update-service --cluster taverna --service taverna --desired-count 0
```
Para zerar de vez, `terraform destroy` (ver `infra/README.md`).

## Trocar um segredo (ex.: chave do Resend)

```bash
aws secretsmanager put-secret-value --secret-id taverna/resend \
  --secret-string 're_nova_chave'
# força as tasks a pegarem o novo valor
aws ecs update-service --cluster taverna --service taverna --force-new-deployment
```

## Acesso ao banco

O RDS não é público. Acesse via ECS Exec de dentro de uma task, ou por um túnel
SSM. Endpoint em `terraform output db_endpoint`; credenciais no secret
`taverna/db`.
