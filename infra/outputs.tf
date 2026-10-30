output "app_url" {
  description = "URL pública da aplicação."
  value       = "https://${local.full_domain}"
}

output "name_servers" {
  description = <<-EOT
    Name servers da hosted zone delegada. Adicione estes NS como registros do
    subdomínio (ex.: 'app') no seu provedor de DNS atual para ativar o domínio
    e permitir a validação do certificado ACM.
  EOT
  value       = var.create_hosted_zone ? aws_route53_zone.app[0].name_servers : []
}

output "alb_dns_name" {
  description = "DNS do ALB (alvo do registro A)."
  value       = module.alb.alb_dns_name
}

output "ecr_repository_url" {
  description = "URL do repositório ECR (usado pelo CI)."
  value       = module.ecs.ecr_repository_url
}

output "ecs_cluster_name" {
  value = module.ecs.cluster_name
}

output "ecs_service_name" {
  value = module.ecs.service_name
}

output "task_definition_family" {
  value = module.ecs.task_definition_family
}

output "github_deploy_role_arn" {
  description = "ARN da role que o GitHub Actions assume via OIDC (secret AWS_ROLE_ARN)."
  value       = aws_iam_role.github_deploy.arn
}

output "aws_region" {
  value = var.aws_region
}

output "log_group" {
  value = module.ecs.log_group
}

output "db_endpoint" {
  description = "Endpoint do RDS (acessível apenas de dentro da VPC)."
  value       = module.database.endpoint
}
