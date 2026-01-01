# ===========================================
# CloudGPUs.io Makefile
# ===========================================

.PHONY: help deploy logs down shell db-backup db-restore validate build test clean

# Project config
PROJECT_NAME := cloudgpus
COMPOSE_FILE := docker-compose.yml
BACKUP_DIR := ./backups
SCHEMA := cloudgpus

# Colors
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m

help:
	@echo "$(GREEN)CloudGPUs.io Operations$(NC)"
	@echo "========================"
	@echo ""
	@echo "$(YELLOW)Deployment:$(NC)"
	@echo "  make deploy        - Build and deploy all services"
	@echo "  make deploy-api    - Deploy API only"
	@echo "  make deploy-workers- Deploy workers only"
	@echo "  make down          - Stop all services"
	@echo "  make restart       - Restart all services"
	@echo ""
	@echo "$(YELLOW)Monitoring:$(NC)"
	@echo "  make logs          - View all logs (follow)"
	@echo "  make logs-api      - View API logs"
	@echo "  make logs-workers  - View worker logs"
	@echo "  make status        - Show service status"
	@echo "  make health        - Check health endpoints"
	@echo ""
	@echo "$(YELLOW)Database:$(NC)"
	@echo "  make db-backup     - Backup database schema"
	@echo "  make db-restore    - Restore from latest backup"
	@echo "  make db-migrate    - Run database migrations"
	@echo "  make db-shell      - Connect to PostgreSQL"
	@echo ""
	@echo "$(YELLOW)Development:$(NC)"
	@echo "  make shell         - Enter API container shell"
	@echo "  make shell-worker  - Enter worker container shell"
	@echo "  make build         - Build images without deploy"
	@echo "  make validate      - Validate compose file"
	@echo "  make clean         - Remove unused images/volumes"
	@echo ""

# ===========================================
# Deployment Commands
# ===========================================

deploy: validate
	@echo "$(GREEN)Deploying CloudGPUs.io...$(NC)"
	@docker compose -f $(COMPOSE_FILE) pull --ignore-pull-failures
	@docker compose -f $(COMPOSE_FILE) build --parallel
	@docker compose -f $(COMPOSE_FILE) up -d --remove-orphans
	@echo "$(GREEN)Deployment complete!$(NC)"
	@$(MAKE) status

deploy-api: validate
	@echo "$(GREEN)Deploying API...$(NC)"
	@docker compose -f $(COMPOSE_FILE) up -d --build api
	@docker compose -f $(COMPOSE_FILE) logs -f api

deploy-workers: validate
	@echo "$(GREEN)Deploying Workers...$(NC)"
	@docker compose -f $(COMPOSE_FILE) up -d --build \
		worker-pricing worker-api worker-notify worker-default worker-browser

down:
	@echo "$(YELLOW)Stopping services...$(NC)"
	@docker compose -f $(COMPOSE_FILE) down
	@echo "$(GREEN)Services stopped$(NC)"

restart:
	@echo "$(YELLOW)Restarting services...$(NC)"
	@docker compose -f $(COMPOSE_FILE) restart
	@$(MAKE) status

# ===========================================
# Monitoring Commands
# ===========================================

logs:
	@docker compose -f $(COMPOSE_FILE) logs -f --tail=100

logs-api:
	@docker compose -f $(COMPOSE_FILE) logs -f --tail=100 api

logs-workers:
	@docker compose -f $(COMPOSE_FILE) logs -f --tail=100 \
		worker-pricing worker-api worker-notify worker-default worker-browser

status:
	@echo "$(GREEN)Service Status:$(NC)"
	@docker compose -f $(COMPOSE_FILE) ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

health:
	@echo "$(GREEN)Health Checks:$(NC)"
	@echo "API: $$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/health || echo 'DOWN')"
	@docker compose -f $(COMPOSE_FILE) ps --format "{{.Name}}: {{.Health}}"

# ===========================================
# Database Commands
# ===========================================

db-backup:
	@echo "$(GREEN)Backing up database schema '$(SCHEMA)'...$(NC)"
	@mkdir -p $(BACKUP_DIR)
	@docker exec supabase-db pg_dump -U postgres -n $(SCHEMA) --no-owner --no-acl \
		> $(BACKUP_DIR)/$(SCHEMA)_$$(date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)Backup saved to $(BACKUP_DIR)/$(NC)"
	@ls -lh $(BACKUP_DIR)/*.sql | tail -5

db-restore:
	@echo "$(YELLOW)Available backups:$(NC)"
	@ls -lt $(BACKUP_DIR)/*.sql 2>/dev/null | head -5 || echo "No backups found"
	@echo ""
	@read -p "Enter backup filename: " file; \
	if [ -f "$(BACKUP_DIR)/$$file" ]; then \
		echo "$(YELLOW)Restoring from $$file...$(NC)"; \
		docker exec -i supabase-db psql -U postgres < $(BACKUP_DIR)/$$file; \
		echo "$(GREEN)Restore complete$(NC)"; \
	else \
		echo "$(RED)File not found$(NC)"; \
	fi

db-migrate:
	@echo "$(GREEN)Running database migrations...$(NC)"
	@docker compose -f $(COMPOSE_FILE) exec api node dist/migrations/run.js

db-shell:
	@docker exec -it supabase-db psql -U postgres -d postgres

# ===========================================
# Development Commands
# ===========================================

shell:
	@docker compose -f $(COMPOSE_FILE) exec api sh

shell-worker:
	@docker compose -f $(COMPOSE_FILE) exec worker-pricing sh

build:
	@echo "$(GREEN)Building images...$(NC)"
	@docker compose -f $(COMPOSE_FILE) build --parallel

validate:
	@echo "$(GREEN)Validating compose file...$(NC)"
	@docker compose -f $(COMPOSE_FILE) config --quiet && echo "$(GREEN)Valid!$(NC)"

clean:
	@echo "$(YELLOW)Cleaning unused Docker resources...$(NC)"
	@docker image prune -f
	@docker network prune -f
	@echo "$(GREEN)Cleanup complete$(NC)"

# ===========================================
# Quick Operations
# ===========================================

scale-workers:
	@read -p "Number of pricing workers (default 1): " n; \
	docker compose -f $(COMPOSE_FILE) up -d --scale worker-pricing=$${n:-1}

bullmq-ui:
	@echo "BullMQ Dashboard: https://api.cloudgpus.io/ops/queues"

emergency-stop:
	@echo "$(RED)EMERGENCY STOP - Stopping all containers$(NC)"
	@docker compose -f $(COMPOSE_FILE) stop
	@docker compose -f $(COMPOSE_FILE) ps
