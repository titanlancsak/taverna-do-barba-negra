# ADR 0003 — Socket.io: adapter Redis + salas por usuário

**Status:** aceito · **Contexto:** WebSocket em tempo real com múltiplas tasks.

## Contexto

O realtime (chat, notificações, campus) mantinha o mapeamento
`userId → sockets` em memória no processo e emitia direto para cada socket. Com
uma VM só isso bastava. Atrás de um ALB com 2+ tasks, cada processo só conhece
os seus sockets: uma mensagem de A (task 1) para B (task 2) nunca chega.

## Decisão

1. **Adapter Redis** (`@socket.io/redis-adapter` + ElastiCache): compartilha
   salas e broadcasts entre as instâncias por pub/sub. Habilitado quando
   `REDIS_URL` está definido; sem ele, o Socket.io usa o adapter em memória.
2. **Salas por usuário:** cada socket entra em `user:<id>` no `connect`.
   Mensagens, notificações e o `conversation_deleted` passam a ser emitidos para
   a sala em vez de sockets individuais. O ban do admin usa
   `io.in('user:<id>').disconnectSockets(true)`, que alcança todas as instâncias.

Mudança **preservadora de comportamento com uma instância**: emitir para
`user:<id>` com uma task atinge exatamente os mesmos sockets de antes. Por isso
o padrão é `desired_count = 1`, e subir para 2+ é seguro para o caminho de
mensagens/notificações.

## Consequências

- **Prós:** mensagens e notificações corretas em qualquer número de instâncias;
  risco baixo (idêntico ao atual quando `desired_count = 1`).
- **Limitação conhecida:** a lista de presença do **campus virtual** ainda é por
  instância (o roster enviado a quem entra só inclui jogadores da mesma task).
  Com sticky sessions isso degrada de forma suave; a correção completa exige um
  store de presença compartilhado (trabalho futuro).
- **Métrica de presença do admin** conta sockets locais — subdimensiona com
  várias instâncias (aceitável; é um indicador).
