data "aws_caller_identity" "current" {}

locals {
  image = "${aws_ecr_repository.this.repository_url}:${var.image_tag}"
}

# =============================== ECR ===============================
resource "aws_ecr_repository" "this" {
  name                 = var.project
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "this" {
  repository = aws_ecr_repository.this.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Mantém apenas as 10 imagens mais recentes"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}

# =========================== CloudWatch ============================
resource "aws_cloudwatch_log_group" "this" {
  name              = "/ecs/${var.project}"
  retention_in_days = 14
}

# =============================== EFS ===============================
# Armazena a mídia enviada por usuários (profile/chat/feed/event), compartilhada
# entre todas as tasks e persistente entre deploys.
resource "aws_efs_file_system" "this" {
  creation_token = "${var.project}-media"
  encrypted      = true

  tags = { Name = "${var.project}-media" }
}

resource "aws_efs_mount_target" "this" {
  count           = length(var.private_subnet_ids)
  file_system_id  = aws_efs_file_system.this.id
  subnet_id       = var.private_subnet_ids[count.index]
  security_groups = [var.efs_sg_id]
}

resource "aws_efs_access_point" "media" {
  file_system_id = aws_efs_file_system.this.id

  posix_user {
    uid = 1000 # usuário `node` da imagem
    gid = 1000
  }

  root_directory {
    path = "/media"
    creation_info {
      owner_uid   = 1000
      owner_gid   = 1000
      permissions = "0755"
    }
  }

  tags = { Name = "${var.project}-media-ap" }
}

# =============================== IAM ===============================
data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# Role de execução: puxa imagem do ECR, escreve logs, lê segredos
resource "aws_iam_role" "execution" {
  name               = "${var.project}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "execution_managed" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "execution_secrets" {
  name = "read-secrets"
  role = aws_iam_role.execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [var.db_secret_arn, var.jwt_secret_arn, var.resend_secret_arn]
    }]
  })
}

# Role da task: a aplicação em si. Não chama APIs da AWS (Resend é HTTP, o
# banco é conexão direta), mas habilitamos o ECS Exec para debugar o container.
resource "aws_iam_role" "task" {
  name               = "${var.project}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy" "task_exec_command" {
  name = "ecs-exec"
  role = aws_iam_role.task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ssmmessages:CreateControlChannel",
        "ssmmessages:CreateDataChannel",
        "ssmmessages:OpenControlChannel",
        "ssmmessages:OpenDataChannel"
      ]
      Resource = "*"
    }]
  })
}

# ============================= ECS =================================
resource "aws_ecs_cluster" "this" {
  name = var.project

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_task_definition" "this" {
  family                   = var.project
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  volume {
    name = "media"
    efs_volume_configuration {
      file_system_id     = aws_efs_file_system.this.id
      transit_encryption = "ENABLED"
      authorization_config {
        access_point_id = aws_efs_access_point.media.id
        iam             = "DISABLED"
      }
    }
  }

  container_definitions = jsonencode([{
    name      = var.project
    image     = local.image
    essential = true

    portMappings = [{
      containerPort = var.container_port
      protocol      = "tcp"
    }]

    environment = [
      { name = "PORT", value = tostring(var.container_port) },
      { name = "NODE_ENV", value = "production" },
      { name = "DB_SSL", value = "true" },
      { name = "MEDIA_ROOT", value = var.media_root },
      { name = "CLIENT_ORIGIN", value = var.client_origin },
      { name = "EMAIL_DOMAIN", value = var.email_domain },
      { name = "REDIS_URL", value = var.redis_url },
    ]

    secrets = [
      { name = "DB_HOST", valueFrom = "${var.db_secret_arn}:DB_HOST::" },
      { name = "DB_PORT", valueFrom = "${var.db_secret_arn}:DB_PORT::" },
      { name = "DB_NAME", valueFrom = "${var.db_secret_arn}:DB_NAME::" },
      { name = "DB_USER", valueFrom = "${var.db_secret_arn}:DB_USER::" },
      { name = "DB_PASSWORD", valueFrom = "${var.db_secret_arn}:DB_PASSWORD::" },
      { name = "JWT_SECRET", valueFrom = var.jwt_secret_arn },
      { name = "RESEND_API_KEY", valueFrom = var.resend_secret_arn },
    ]

    mountPoints = [{
      sourceVolume  = "media"
      containerPath = var.media_root
      readOnly      = false
    }]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.this.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "app"
      }
    }
  }])
}

resource "aws_ecs_service" "this" {
  name            = var.project
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  enable_execute_command = true

  health_check_grace_period_seconds = 60

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  network_configuration {
    subnets          = var.public_subnet_ids
    security_groups  = [var.app_sg_id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = var.project
    container_port   = var.container_port
  }

  # O pipeline (GitHub Actions) registra novas revisões da task definition com a
  # imagem nova; o Terraform não deve sobrescrever isso em applies seguintes.
  lifecycle {
    ignore_changes = [task_definition]
  }
}
