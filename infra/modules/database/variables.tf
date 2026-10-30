variable "project" {
  type = string
}

variable "db_name" {
  type = string
}

variable "db_username" {
  type = string
}

variable "instance_class" {
  type = string
}

variable "allocated_storage" {
  type = number
}

variable "multi_az" {
  type = bool
}

variable "subnet_ids" {
  description = "Subnets privadas para o DB subnet group."
  type        = list(string)
}

variable "security_group_ids" {
  type = list(string)
}
