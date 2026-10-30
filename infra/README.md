# Infraestrutura (AWS + Terraform)

Deploy da Blackbeard Tavern na AWS como código. Toda a infraestrutura —
rede, banco, cache, container, load balancer, TLS e DNS — é provisionada por
Terraform, e cada `push` na `main` dispara o deploy via GitHub Actions.

- Arquitetura detalhada: [`../docs/architecture.md`](../docs/architecture.md)
- Operação do dia a dia (logs, rollback, escala): [`../docs/runbook.md`](../docs/runbook.md)
- Decisões de projeto: [`../docs/adr/`](../docs/adr/)

## Visão geral

```
Internet ──HTTPS──> Route 53 ──> ALB (ACM/TLS, WebSocket) ──> ECS Fargate (Node + Socket.io)
                                                                 ├─> RDS PostgreSQL
                                                                 ├─> ElastiCache Redis (adapter Socket.io)
                                                                 └─> EFS (uploads de mídia)
```

Modo **enxuto**: tasks Fargate em subnets públicas (alcançam ECR/S3/Secrets via
Internet Gateway, sem NAT Gateway); RDS, Redis e EFS isolados em subnets
privadas. O subdomínio `app.blackbeardtavern.me` sobe sem tocar no domínio raiz
que já está no ar.

## Pré-requisitos (Fase 0)

1. **Conta AWS** com billing configurado.
2. **Usuário IAM** com acesso administrativo (ou permissões equivalentes) e
   chaves de acesso para uso local do Terraform.
3. Ferramentas locais:
   ```bash
   # macOS (Homebrew)
   brew install terraform awscli
   # Docker Desktop para build local da imagem (opcional; o CI também builda)

   aws configure            # cole Access Key / Secret / região ap-northeast-1
   aws sts get-caller-identity   # confirma que está autenticado
   ```

## Passo a passo do deploy

### 1. Backend de estado (uma vez)

```bash
cd infra/bootstrap
terraform init && terraform apply
terraform output backend_config    # copie a saída
```

Cole os valores no bloco `backend "s3"` de [`backend.tf`](backend.tf),
descomente-o e inicialize o estado remoto:

```bash
cd ..
terraform init                     # migra o estado para o S3
```

### 2. Variáveis

```bash
cp terraform.tfvars.example terraform.tfvars
# edite domain/subdomain/github_repo e, se já tiver, a chave do Resend:
export TF_VAR_resend_api_key="re_xxx"    # ou coloque em terraform.tfvars (não versionado)
```

### 3. DNS — criar a zona delegada e delegar os NS

A validação do certificado ACM só conclui depois que o subdomínio estiver
delegado. Por isso criamos a hosted zone primeiro:

```bash
terraform apply -target=aws_route53_zone.app
terraform output name_servers
```

No seu provedor de DNS atual (onde `blackbeardtavern.me` está registrado),
crie registros **NS** para o subdomínio `app` apontando para os 4 name servers
retornados. Ex.: `app  NS  ns-123.awsdns-45.com.` (um por servidor).

### 4. Provisionar tudo

```bash
terraform apply
```

O ACM valida assim que os NS propagarem (minutos a algumas horas). O ECS service
sobe sem tasks saudáveis ainda — ele só terá imagem após o primeiro deploy do CI
(próximo passo). Guarde as saídas:

```bash
terraform output
# github_deploy_role_arn  -> vira o secret AWS_ROLE_ARN no GitHub
# app_url                 -> https://app.blackbeardtavern.me
```

### 5. Configurar o GitHub Actions

No repositório, em **Settings → Secrets and variables → Actions**:

- Secret `AWS_ROLE_ARN` = valor de `github_deploy_role_arn`.
- Variable `AWS_REGION` = `ap-northeast-1` (opcional; é o padrão).

### 6. Primeiro deploy

```bash
git push origin main        # ou rode o workflow "Deploy to AWS" manualmente
```

O pipeline builda a imagem, envia pro ECR, roda as migrações como uma task
one-off e atualiza o service. Quando estabilizar, acesse `app_url`.

## CI/CD

[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) a cada push na
`main`:

1. autentica na AWS via **OIDC** (sem chaves estáticas no GitHub);
2. builda e envia a imagem Docker pro ECR (tags `:<sha>` e `:latest`);
3. registra uma nova revisão da task definition com a imagem nova;
4. roda `node db/migrate.js` como task one-off (aborta se falhar);
5. atualiza o ECS service e espera estabilizar (deploy rolling).

## Custos (estimativa, região Tóquio)

| Recurso | Config | ~USD/mês |
|---|---|---|
| ALB | 1 | 16–20 |
| RDS PostgreSQL | db.t4g.micro, single-AZ, 20 GB | 12–15 |
| ElastiCache Redis | cache.t4g.micro | 9–12 |
| Fargate | 1 task 0.5 vCPU / 1 GB | 9–18 |
| EFS / ECR / Route 53 / Secrets | uso baixo | 2–4 |
| **Total** | | **~48–70** |

Alavancas para reduzir: `enable_redis = false` + `desired_count = 1`
(dispensa o ElastiCache), Fargate Spot, ou destruir o ambiente quando não
estiver demonstrando. Veja o runbook.

## Teardown

```bash
terraform destroy
# e, se quiser remover o estado:
cd bootstrap && terraform destroy
```

Depois, remova os registros NS do subdomínio no provedor de DNS.
