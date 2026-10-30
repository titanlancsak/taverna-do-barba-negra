# ============================================================================
# Bootstrap do estado remoto do Terraform.
# Cria UMA vez o bucket S3 (estado) e a tabela DynamoDB (lock). Este módulo usa
# estado LOCAL (não migre o estado dele para o S3). Rode-o antes do infra/ raiz.
#
#   cd infra/bootstrap
#   terraform init && terraform apply
#   # copie os outputs para o bloco backend "s3" em infra/backend.tf
# ============================================================================

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.60" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
}

variable "project" {
  type    = string
  default = "taverna"
}

variable "aws_region" {
  type    = string
  default = "ap-northeast-1"
}

provider "aws" {
  region = var.aws_region
}

resource "random_id" "suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "state" {
  bucket        = "${var.project}-tfstate-${random_id.suffix.hex}"
  force_destroy = false
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "locks" {
  name         = "${var.project}-tf-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }
}

output "state_bucket" {
  value = aws_s3_bucket.state.id
}

output "lock_table" {
  value = aws_dynamodb_table.locks.name
}

output "backend_config" {
  description = "Cole isto no bloco backend \"s3\" de infra/backend.tf"
  value       = <<-EOT
    bucket         = "${aws_s3_bucket.state.id}"
    key            = "global/terraform.tfstate"
    region         = "${var.aws_region}"
    dynamodb_table = "${aws_dynamodb_table.locks.name}"
    encrypt        = true
  EOT
}
