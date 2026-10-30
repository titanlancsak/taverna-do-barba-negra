# Hosted zone DELEGADA só para o subdomínio (ex.: app.blackbeardtavern.me).
# Você adiciona os NS retornados (output `name_servers`) no seu provedor de DNS
# atual, delegando apenas esse subdomínio — o domínio raiz que está no ar na VM
# não é tocado. Assim o cutover é 100% seguro.
resource "aws_route53_zone" "app" {
  count = var.create_hosted_zone ? 1 : 0
  name  = local.full_domain
}

locals {
  zone_id = var.create_hosted_zone ? aws_route53_zone.app[0].zone_id : var.hosted_zone_id
}

# Certificado TLS gratuito (ACM), validado por DNS.
resource "aws_acm_certificate" "app" {
  domain_name       = local.full_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# Registros de validação do ACM, criados automaticamente na hosted zone.
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.app.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }

  zone_id         = local.zone_id
  name            = each.value.name
  type            = each.value.type
  ttl             = 60
  records         = [each.value.record]
  allow_overwrite = true
}

# Espera a validação concluir. ATENÇÃO: isso só completa depois que os NS do
# subdomínio estiverem delegados no seu registrador (veja o README, passo DNS).
resource "aws_acm_certificate_validation" "app" {
  certificate_arn         = aws_acm_certificate.app.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

# Registro A (alias) do subdomínio apontando para o ALB.
resource "aws_route53_record" "app" {
  zone_id = local.zone_id
  name    = local.full_domain
  type    = "A"

  alias {
    name                   = module.alb.alb_dns_name
    zone_id                = module.alb.alb_zone_id
    evaluate_target_health = true
  }
}
