variable "project" {
  description = "Nome do projeto, usado como prefixo e em tags."
  type        = string
  default     = "taverna"
}

variable "environment" {
  description = "Ambiente (prod, staging, ...)."
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "Região da AWS. Tóquio por padrão (público no Japão)."
  type        = string
  default     = "ap-northeast-1"
}

# --- DNS / domínio ---

variable "domain" {
  description = "Domínio raiz já existente (ex.: blackbeardtavern.me)."
  type        = string
  default     = "blackbeardtavern.me"
}

variable "subdomain" {
  description = "Subdomínio onde a aplicação na AWS vai responder."
  type        = string
  default     = "app"
}

variable "create_hosted_zone" {
  description = <<-EOT
    Se true (recomendado para 'subdomínio primeiro'), cria uma hosted zone
    delegada só para <subdomain>.<domain> — você adiciona os NS retornados no
    seu provedor de DNS atual, sem tocar no domínio raiz que está no ar.
    Se false, usa uma hosted zone existente informada em hosted_zone_id.
  EOT
  type        = bool
  default     = true
}

variable "hosted_zone_id" {
  description = "ID de uma hosted zone existente (usado só quando create_hosted_zone = false)."
  type        = string
  default     = ""
}

# --- Rede ---

variable "vpc_cidr" {
  description = "CIDR da VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "az_count" {
  description = "Quantidade de Availability Zones (mínimo 2 para o ALB)."
  type        = number
  default     = 2
}

# --- Aplicação / container ---

variable "container_port" {
  description = "Porta em que o container escuta."
  type        = number
  default     = 3000
}

variable "image_tag" {
  description = "Tag da imagem no ECR usada na task definition inicial. O CI gerencia as revisões seguintes."
  type        = string
  default     = "latest"
}

variable "desired_count" {
  description = <<-EOT
    Número de tasks Fargate. Padrão 1 (comportamento idêntico à VM atual).
    Com Redis habilitado, pode subir para 2+ para demonstrar escala horizontal:
    mensagens e notificações são cross-instância via salas por usuário + adapter.
  EOT
  type        = number
  default     = 1
}

variable "task_cpu" {
  description = "CPU da task Fargate (256 = 0.25 vCPU)."
  type        = number
  default     = 512
}

variable "task_memory" {
  description = "Memória da task Fargate em MiB."
  type        = number
  default     = 1024
}

# --- Banco de dados ---

variable "db_name" {
  description = "Nome do banco PostgreSQL."
  type        = string
  default     = "taverna"
}

variable "db_username" {
  description = "Usuário master do PostgreSQL."
  type        = string
  default     = "taverna"
}

variable "db_instance_class" {
  description = "Classe da instância RDS."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "Armazenamento do RDS em GB."
  type        = number
  default     = 20
}

variable "db_multi_az" {
  description = "Multi-AZ no RDS (true = mais caro, alta disponibilidade)."
  type        = bool
  default     = false
}

# --- Redis / cache ---

variable "enable_redis" {
  description = "Cria o ElastiCache Redis e liga o adapter do Socket.io (escala horizontal)."
  type        = bool
  default     = true
}

variable "redis_node_type" {
  description = "Tipo do nó do ElastiCache."
  type        = string
  default     = "cache.t4g.micro"
}

# --- Segredos da aplicação (sensíveis) ---

variable "resend_api_key" {
  description = "Chave da API do Resend (e-mail transacional). Informe via TF_VAR_resend_api_key ou tfvars não versionado."
  type        = string
  default     = ""
  sensitive   = true
}

variable "email_domain" {
  description = "Domínio usado nos e-mails enviados pelo Resend."
  type        = string
  default     = ""
}

# --- CI/CD ---

variable "github_repo" {
  description = "Repositório GitHub no formato owner/repo, para a role OIDC do deploy."
  type        = string
  default     = "titanlancsak/taverna-do-barba-negra"
}
