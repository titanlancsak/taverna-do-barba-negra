resource "random_password" "db" {
  length           = 24
  special          = true
  override_special = "!#$%^&*()-_=+[]{}"
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.project}-db-subnets"
  subnet_ids = var.subnet_ids
  tags       = { Name = "${var.project}-db-subnets" }
}

resource "aws_db_instance" "this" {
  identifier     = "${var.project}-postgres"
  engine         = "postgres"
  engine_version = "16.4"

  instance_class    = var.instance_class
  allocated_storage = var.allocated_storage
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = var.security_group_ids
  publicly_accessible    = false
  multi_az               = var.multi_az

  backup_retention_period = 7
  apply_immediately       = true

  # Flags amigáveis para um projeto de portfólio. Em produção real:
  # deletion_protection = true e skip_final_snapshot = false.
  skip_final_snapshot = true
  deletion_protection = false

  tags = { Name = "${var.project}-postgres" }
}

# Credenciais completas de conexão no Secrets Manager. A task ECS injeta cada
# chave como variável de ambiente (DB_HOST, DB_PASSWORD, ...).
resource "aws_secretsmanager_secret" "db" {
  name                    = "${var.project}/db"
  description             = "Credenciais do PostgreSQL (${var.project})"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id
  secret_string = jsonencode({
    DB_HOST     = aws_db_instance.this.address
    DB_PORT     = tostring(aws_db_instance.this.port)
    DB_NAME     = var.db_name
    DB_USER     = var.db_username
    DB_PASSWORD = random_password.db.result
  })
}
