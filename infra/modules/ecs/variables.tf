variable "project" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "app_sg_id" {
  type = string
}

variable "efs_sg_id" {
  type = string
}

variable "container_port" {
  type = number
}

variable "image_tag" {
  type = string
}

variable "desired_count" {
  type = number
}

variable "task_cpu" {
  type = number
}

variable "task_memory" {
  type = number
}

variable "target_group_arn" {
  type = string
}

variable "media_root" {
  description = "Caminho onde o EFS é montado no container (= env MEDIA_ROOT)."
  type        = string
  default     = "/data/media"
}

# Fontes de configuração / segredos
variable "db_secret_arn" {
  type = string
}

variable "jwt_secret_arn" {
  type = string
}

variable "resend_secret_arn" {
  type = string
}

variable "redis_url" {
  type    = string
  default = ""
}

variable "client_origin" {
  type = string
}

variable "email_domain" {
  type    = string
  default = ""
}
