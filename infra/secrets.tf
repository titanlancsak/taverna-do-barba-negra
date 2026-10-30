# JWT_SECRET gerado automaticamente (não precisa ser informado).
resource "random_password" "jwt" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "jwt" {
  name                    = "${var.project}/jwt"
  description             = "JWT secret (${var.project})"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id     = aws_secretsmanager_secret.jwt.id
  secret_string = random_password.jwt.result
}

# RESEND_API_KEY — informado via variável sensível (TF_VAR_resend_api_key ou
# tfvars não versionado). Pode começar vazio e ser preenchido depois com:
#   aws secretsmanager put-secret-value --secret-id taverna/resend --secret-string '...'
resource "aws_secretsmanager_secret" "resend" {
  name                    = "${var.project}/resend"
  description             = "Resend API key (${var.project})"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "resend" {
  secret_id     = aws_secretsmanager_secret.resend.id
  secret_string = var.resend_api_key != "" ? var.resend_api_key : "PLACEHOLDER"
}
