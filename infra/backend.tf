# Estado remoto do Terraform em S3, com lock via DynamoDB.
# Os recursos de backend são criados UMA vez pelo módulo em infra/bootstrap
# (ver infra/bootstrap/README.md). Depois, preencha os valores abaixo com os
# nomes gerados e rode `terraform init` para migrar o estado.
#
# Mantido comentado para permitir o primeiro `terraform init` local sem backend.
# Descomente e ajuste bucket/region/dynamodb_table conforme o bootstrap.

# terraform {
#   backend "s3" {
#     bucket         = "taverna-tfstate-xxxxxxxx"
#     key            = "global/terraform.tfstate"
#     region         = "ap-northeast-1"
#     dynamodb_table = "taverna-tf-locks"
#     encrypt        = true
#   }
# }
