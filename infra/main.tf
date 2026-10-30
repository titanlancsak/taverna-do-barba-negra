locals {
  full_domain   = "${var.subdomain}.${var.domain}"
  client_origin = "https://${var.subdomain}.${var.domain}"
  redis_url     = var.enable_redis ? module.cache[0].redis_url : ""
}

module "network" {
  source         = "./modules/network"
  project        = var.project
  vpc_cidr       = var.vpc_cidr
  az_count       = var.az_count
  container_port = var.container_port
}

module "database" {
  source             = "./modules/database"
  project            = var.project
  db_name            = var.db_name
  db_username        = var.db_username
  instance_class     = var.db_instance_class
  allocated_storage  = var.db_allocated_storage
  multi_az           = var.db_multi_az
  subnet_ids         = module.network.private_subnet_ids
  security_group_ids = [module.network.db_sg_id]
}

module "cache" {
  source             = "./modules/cache"
  count              = var.enable_redis ? 1 : 0
  project            = var.project
  node_type          = var.redis_node_type
  subnet_ids         = module.network.private_subnet_ids
  security_group_ids = [module.network.redis_sg_id]
}

module "alb" {
  source            = "./modules/alb"
  project           = var.project
  vpc_id            = module.network.vpc_id
  public_subnet_ids = module.network.public_subnet_ids
  security_group_id = module.network.alb_sg_id
  container_port    = var.container_port
  certificate_arn   = aws_acm_certificate_validation.app.certificate_arn
}

module "ecs" {
  source             = "./modules/ecs"
  project            = var.project
  aws_region         = var.aws_region
  public_subnet_ids  = module.network.public_subnet_ids
  private_subnet_ids = module.network.private_subnet_ids
  app_sg_id          = module.network.app_sg_id
  efs_sg_id          = module.network.efs_sg_id
  container_port     = var.container_port
  image_tag          = var.image_tag
  desired_count      = var.desired_count
  task_cpu           = var.task_cpu
  task_memory        = var.task_memory
  target_group_arn   = module.alb.target_group_arn

  db_secret_arn     = module.database.secret_arn
  jwt_secret_arn    = aws_secretsmanager_secret.jwt.arn
  resend_secret_arn = aws_secretsmanager_secret.resend.arn
  redis_url         = local.redis_url
  client_origin     = local.client_origin
  email_domain      = var.email_domain

  # Garante que o listener/ALB existam antes do service (associação do TG).
  depends_on = [module.alb]
}
