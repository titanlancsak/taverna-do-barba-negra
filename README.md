<div align="center">

# 🏴‍☠️ Blackbeard Tavern

**A full-stack social network + utility-tools platform, built solo and shipped to production on AWS.**

### &nbsp;&nbsp;[&nbsp;🇬🇧&nbsp; **English** &nbsp;](#-english)&nbsp;&nbsp;·&nbsp;&nbsp;[&nbsp;🇯🇵&nbsp; **日本語** &nbsp;](#-日本語)&nbsp;&nbsp;

🌐 **Live:** [blackbeardtavern.me](https://blackbeardtavern.me) &nbsp;·&nbsp; ☁️ **AWS deploy:** [app.blackbeardtavern.me](https://app.blackbeardtavern.me)

`Node.js` · `Express 5` · `Socket.io` · `PostgreSQL` · `Redis` · `Docker` · `Terraform` · `AWS ECS Fargate` · `GitHub Actions`

</div>

---

## 🇬🇧 English

### What it is

**Blackbeard Tavern** is a web platform for university students that combines two products in one:

1. **A social network (SNS)** — real-time chat, a global feed, friends, groups, events, notifications and even a **multiplayer virtual campus** you can walk around in.
2. **A toolbox** — a dozen self-serve utilities: image/audio converters, a video downloader, a QR generator, an advanced subnet calculator, a music player, a typing trainer, plus two in-browser learning labs (a real **Linux** machine and a **Cisco IOS** CLI simulator).

The whole UI is in **Japanese** (the audience is students at Tokyo University of Technology, Hachioji campus). I designed, built, deployed and now operate it **end to end, on my own** — frontend, backend, database, real-time layer, cloud infrastructure and CI/CD.

> This project is my way of proving I can take an idea from a blank repository to a live, scalable, cloud-hosted product — not just write code, but make engineering decisions and own the whole lifecycle.

### Why it's worth a look

| It demonstrates… | …through |
|---|---|
| **Real-time systems at scale** | WebSocket (Socket.io) for chat, notifications and multiplayer, made correct across multiple server instances with a Redis pub/sub adapter and per-user rooms |
| **Cloud architecture** | A production AWS deployment: ECS Fargate behind an Application Load Balancer, RDS PostgreSQL, ElastiCache Redis and EFS in isolated private subnets |
| **Infrastructure as Code** | The entire cloud environment is defined in **Terraform** — reproducible, version-controlled, no click-ops |
| **CI/CD & DevOps** | Every push to `main` builds a Docker image, runs database migrations and does a zero-downtime rolling deploy — authenticating to AWS with **OIDC** (no long-lived secrets) |
| **Backend engineering** | A modular Express 5 API, JWT auth with bcrypt, email verification & password reset, rate limiting, media processing with `sharp`/`ffmpeg`, idempotent SQL migrations |
| **Security & moderation** | Chained security groups, secrets in AWS Secrets Manager, a reports system and an admin panel that can remove content and ban users (and disconnect them live, across every instance) |
| **Product thinking** | A coherent, fully localized (Japanese) product with a landing page, onboarding and a real feature set people actually use |

### Feature tour

**Social network**
- 📝 **Global feed** with posts, images and interactions
- 💬 **Real-time chat** — direct messages and groups, with typing indicators and live delivery across all your open tabs
- 🔔 **Live notifications** pushed over WebSocket
- 👥 **Friends, groups and events**
- 🗺️ **Virtual campus** — a multiplayer 2D map (built with Phaser) where users move around a recreation of the Hachioji campus in real time
- 🔎 **Global search** across users and content
- 🛡️ **Moderation** — user reports, plus an admin panel to delete content and ban accounts with a reason

**Tools**
- 🖼️ **Image converter** (server-side with `sharp`) and 🎵 **audio converter** (`ffmpeg`)
- ⬇️ **Video downloader** · 🔳 **QR code generator** · 🎧 **music player**
- 🌐 **Advanced subnet calculator** — IPv4/IPv6, VLSM, automatic subnetting and history
- ⌨️ **Typing trainer** · 📚 **free books** / Linux-distro guides
- 🐧 **Linux lab** — a real x86 Linux machine emulated **entirely in the browser** (v86 / WebAssembly); nothing touches the server
- 🔧 **Cisco IOS lab** — a client-side Cisco IOS CLI simulator that parses commands and builds a running-config, for practicing networking

**Accounts & security**
- 🔐 JWT authentication with bcrypt-hashed passwords
- ✉️ Email verification, password reset and account deletion (transactional email via Resend)
- 🚦 Rate limiting on sensitive endpoints

### Architecture at a glance

```
                      HTTPS 443
  Users ──▶ Route 53 ──▶ Application Load Balancer  (TLS via ACM · sticky sessions · WebSocket)
                                   │  HTTP 3000
                        ┌──────────┴──────────┐
                        ▼                     ▼
                  Fargate task 1        Fargate task 2        ← Express + Socket.io (stateless, container)
                        │   └──── pub/sub ────┐   │
                        ▼                     ▼   ▼
   ┌────────────────── private subnets (no internet route) ──────────────────┐
   │   RDS PostgreSQL        ElastiCache Redis        EFS (shared uploads)    │
   └──────────────────────────────────────────────────────────────────────── ┘
```

**The hardest part — and the most interesting:** running WebSocket behind a load balancer with more than one instance. Three problems, three fixes:

1. **Long-lived connections** — the ALB does the HTTP→WebSocket upgrade natively; idle timeout raised to 3600s.
2. **Session affinity** — the Socket.io handshake and long-polling fallback need the client to always reach the same task, so the target group uses **sticky sessions**.
3. **Distributed state** — with 2+ tasks each process only sees its own sockets. Fixed with the **Socket.io Redis adapter** (events propagate between instances via pub/sub) and **per-user rooms** (`user:<id>`): messages target a room, not a socket, so they reach every tab of a user on any instance — and let the admin disconnect a banned user everywhere at once.

The design works identically on **one** instance (default) and scales horizontally to **many** without code changes.

### Tech stack

| Layer | Technology |
|---|---|
| **Frontend** | Vanilla HTML / CSS / JavaScript · Phaser (virtual campus) · v86 & xterm.js (labs) |
| **Backend** | Node.js · Express 5 · Socket.io |
| **Data** | PostgreSQL · Redis (Socket.io adapter) |
| **Media** | `sharp` (images) · `ffmpeg` (audio/video) |
| **Auth** | JWT · bcrypt · Resend (transactional email) |
| **Cloud (AWS)** | ECS Fargate · ALB · ACM · Route 53 · RDS · ElastiCache · EFS · ECR · Secrets Manager · CloudWatch |
| **IaC / DevOps** | Terraform · Docker · GitHub Actions (CI/CD) · OIDC |

### How it's built & operated

- **Modular backend** — each domain lives in `backend/modules/<name>/` with its own controller and routes (auth, feed, chat, friends, groups, events, notifications, profile, search, reports, admin…).
- **Idempotent migrations** — plain SQL in `backend/db/migrations/`, tracked in a `schema_migrations` table and run as a one-off task in the pipeline *before* the new version goes live.
- **Stateless containers** — no user data lives in a container; uploads go to EFS, shared and persistent across deploys and instances.
- **Lean networking** — tasks run in public subnets with egress via the Internet Gateway, which removes the need for a NAT Gateway (~US$32/month saved) while keeping the databases fully private.
- **Documented** — architecture diagrams, an operations runbook and Architecture Decision Records live under [`docs/`](docs/).

### Repository layout

```
backend/     Express + Socket.io API, feature modules, SQL migrations
frontend/    Static site (HTML / CSS / JS), tools, labs, virtual campus
infra/       Terraform — VPC, RDS, Redis, EFS, ECS, ALB, ACM, Route 53, OIDC
docs/        Architecture, runbook, Architecture Decision Records
Dockerfile   Production image (Node + ffmpeg)
.github/     CI/CD workflow
```

### Run it locally

```bash
cd backend
cp .env.example .env     # DB credentials, JWT_SECRET, etc.
npm install
node db/migrate.js       # run migrations
npm start                # serves API + frontend on http://localhost:3000
```

<div align="right"><a href="#-blackbeard-tavern">↑ back to top</a></div>

---

## 🇯🇵 日本語

### 概要

**Blackbeard Tavern（ブラックベアード・タバーン）** は、大学生向けの Web プラットフォームで、2 つのプロダクトを 1 つにまとめたものです。

1. **SNS（ソーシャルネットワーク）** — リアルタイムチャット、グローバルフィード、フレンド、グループ、イベント、通知、さらに歩き回れる **マルチプレイヤーのバーチャルキャンパス** まで。
2. **ツール集** — 画像・音声コンバーター、動画ダウンローダー、QR コード生成、高機能サブネット計算機、音楽プレーヤー、タイピング練習、そしてブラウザ内で動く 2 つの学習ラボ（本物の **Linux** マシンと **Cisco IOS** CLI シミュレーター）など十数種類。

UI は **すべて日本語**（想定ユーザーは東京工科大学・八王子キャンパスの学生です）。フロントエンド、バックエンド、データベース、リアルタイム基盤、クラウドインフラ、CI/CD まで、**すべて一人で**設計・開発・デプロイし、現在も運用しています。

> このプロジェクトは、空のリポジトリから「本番稼働する・スケール可能な・クラウドホスティングされたプロダクト」まで一人で到達できること — コードを書くだけでなく、技術的な意思決定を行い、ライフサイクル全体に責任を持てること — を示すためのものです。

### 見どころ

| 示せること | 手段 |
|---|---|
| **スケールするリアルタイム基盤** | チャット・通知・マルチプレイヤーに WebSocket（Socket.io）を採用。Redis の pub/sub アダプターとユーザー単位のルームで、複数サーバーインスタンス間でも正しく動作 |
| **クラウドアーキテクチャ** | 本番 AWS 構成：ALB の背後の ECS Fargate、隔離されたプライベートサブネット内の RDS PostgreSQL・ElastiCache Redis・EFS |
| **Infrastructure as Code** | クラウド環境全体を **Terraform** で定義。再現可能・バージョン管理済み・手作業なし |
| **CI/CD・DevOps** | `main` への push ごとに Docker イメージをビルドし、DB マイグレーションを実行し、ダウンタイムなしのローリングデプロイ。AWS への認証は **OIDC**（長期シークレットなし） |
| **バックエンド設計** | モジュール化された Express 5 API、JWT 認証＋bcrypt、メール認証・パスワードリセット、レート制限、`sharp`/`ffmpeg` によるメディア処理、冪等な SQL マイグレーション |
| **セキュリティ・モデレーション** | 連鎖するセキュリティグループ、Secrets Manager でのシークレット管理、通報システム、コンテンツ削除とユーザーBAN（全インスタンス横断でリアルタイム切断）が可能な管理画面 |
| **プロダクト思考** | ランディングページ・オンボーディング・実際に使われる機能群を備えた、一貫性のある完全日本語ローカライズ済みプロダクト |

### 機能ツアー

**SNS**
- 📝 投稿・画像・インタラクションを備えた **グローバルフィード**
- 💬 **リアルタイムチャット** — DM とグループ、入力中インジケーター付き。開いている全タブに即時配信
- 🔔 WebSocket 経由の **ライブ通知**
- 👥 **フレンド・グループ・イベント**
- 🗺️ **バーチャルキャンパス** — 八王子キャンパスを再現した 2D マップ（Phaser 製）を、ユーザーがリアルタイムに歩き回れるマルチプレイヤー空間
- 🔎 ユーザー・コンテンツ横断の **グローバル検索**
- 🛡️ **モデレーション** — 通報機能と、コンテンツ削除・理由付きBANができる管理画面

**ツール**
- 🖼️ **画像コンバーター**（サーバー側 `sharp`）・🎵 **音声コンバーター**（`ffmpeg`）
- ⬇️ **動画ダウンローダー** ・ 🔳 **QR コード生成** ・ 🎧 **音楽プレーヤー**
- 🌐 **高機能サブネット計算機** — IPv4/IPv6、VLSM、自動サブネット分割、履歴機能
- ⌨️ **タイピング練習** ・ 📚 **無料書籍** / Linux ディストリガイド
- 🐧 **Linux ラボ** — 本物の x86 Linux を **ブラウザ内だけ** でエミュレート（v86 / WebAssembly）。サーバーには一切触れません
- 🔧 **Cisco IOS ラボ** — コマンドを解析して running-config を組み立てるクライアントサイドの Cisco IOS CLI シミュレーター。ネットワーク学習用

**アカウント・セキュリティ**
- 🔐 bcrypt でハッシュ化したパスワードと JWT 認証
- ✉️ メール認証・パスワードリセット・アカウント削除（Resend によるトランザクションメール）
- 🚦 重要エンドポイントへのレート制限

### アーキテクチャ概要

```
                      HTTPS 443
  ユーザー ─▶ Route 53 ─▶ Application Load Balancer  (ACM で TLS · スティッキー · WebSocket)
                                   │  HTTP 3000
                        ┌──────────┴──────────┐
                        ▼                     ▼
                 Fargate タスク1        Fargate タスク2       ← Express + Socket.io（ステートレス / コンテナ）
                        │   └──── pub/sub ────┐   │
                        ▼                     ▼   ▼
   ┌────────────── プライベートサブネット（インターネット経路なし）──────────────┐
   │   RDS PostgreSQL        ElastiCache Redis        EFS（共有アップロード）    │
   └─────────────────────────────────────────────────────────────────────────┘
```

**最難関であり、最も面白い部分：** 複数インスタンスのロードバランサー背後で WebSocket を動かすこと。3 つの課題を 3 つの方法で解決しました。

1. **長時間接続** — ALB が HTTP→WebSocket のアップグレードをネイティブ処理。アイドルタイムアウトを 3600 秒に引き上げ。
2. **セッションの固定** — Socket.io のハンドシェイクとロングポーリングのフォールバックは、クライアントが常に同じタスクへ到達する必要があるため、ターゲットグループで **スティッキーセッション** を使用。
3. **分散状態** — タスクが 2 つ以上だと各プロセスは自分のソケットしか見えません。**Socket.io Redis アダプター**（pub/sub でインスタンス間にイベントを伝播）と **ユーザー単位のルーム**（`user:<id>`）で解決。メッセージはソケットではなくルーム宛なので、どのインスタンスにある全タブにも届き、BANされたユーザーを全インスタンスで一斉に切断することもできます。

この設計は **1 インスタンス**（デフォルト）でも **複数** でもコードを変えずに同一に動作し、水平スケールできます。

### 技術スタック

| レイヤー | 技術 |
|---|---|
| **フロントエンド** | Vanilla HTML / CSS / JavaScript · Phaser（バーチャルキャンパス）· v86 & xterm.js（ラボ） |
| **バックエンド** | Node.js · Express 5 · Socket.io |
| **データ** | PostgreSQL · Redis（Socket.io アダプター） |
| **メディア** | `sharp`（画像）· `ffmpeg`（音声・動画） |
| **認証** | JWT · bcrypt · Resend（トランザクションメール） |
| **クラウド（AWS）** | ECS Fargate · ALB · ACM · Route 53 · RDS · ElastiCache · EFS · ECR · Secrets Manager · CloudWatch |
| **IaC / DevOps** | Terraform · Docker · GitHub Actions（CI/CD）· OIDC |

### 構築・運用のポイント

- **モジュール化されたバックエンド** — 各ドメインが `backend/modules/<name>/` にコントローラーとルートを持つ（auth, feed, chat, friends, groups, events, notifications, profile, search, reports, admin など）。
- **冪等なマイグレーション** — `backend/db/migrations/` のプレーンな SQL を `schema_migrations` テーブルで追跡し、新バージョン公開 *前* にパイプラインのワンオフタスクとして実行。
- **ステートレスなコンテナ** — ユーザーデータはコンテナに置かず、アップロードは EFS へ。デプロイやインスタンス交換をまたいで共有・永続化。
- **無駄のないネットワーク** — タスクはパブリックサブネットで動き、Internet Gateway 経由で外部通信するため NAT Gateway が不要（月約 32 ドルの節約）。一方でデータベースは完全にプライベート。
- **ドキュメント完備** — アーキテクチャ図・運用 Runbook・Architecture Decision Record を [`docs/`](docs/) に整備。

### リポジトリ構成

```
backend/     Express + Socket.io API、機能モジュール、SQL マイグレーション
frontend/    静的サイト（HTML / CSS / JS）、ツール、ラボ、バーチャルキャンパス
infra/       Terraform — VPC, RDS, Redis, EFS, ECS, ALB, ACM, Route 53, OIDC
docs/        アーキテクチャ、Runbook、Architecture Decision Record
Dockerfile   本番イメージ（Node + ffmpeg）
.github/     CI/CD ワークフロー
```

### ローカルでの実行

```bash
cd backend
cp .env.example .env     # DB 認証情報、JWT_SECRET など
npm install
node db/migrate.js       # マイグレーション実行
npm start                # http://localhost:3000 で API + フロントを配信
```

<div align="right"><a href="#-blackbeard-tavern">↑ 上に戻る</a></div>

---

<div align="center">

**Built & operated solo by Santos Lucas** &nbsp;·&nbsp; 一人で開発・運用

📖 [`docs/architecture.md`](docs/architecture.md) &nbsp;·&nbsp; 🛠️ [`infra/README.md`](infra/README.md) &nbsp;·&nbsp; 📋 [`docs/runbook.md`](docs/runbook.md) &nbsp;·&nbsp; 🧭 [`docs/adr/`](docs/adr/)

</div>
