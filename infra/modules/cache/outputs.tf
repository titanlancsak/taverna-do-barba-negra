output "redis_url" {
  value = "redis://${aws_elasticache_cluster.this.cache_nodes[0].address}:6379"
}
