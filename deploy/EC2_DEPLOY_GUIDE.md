# Guía de Despliegue en AWS EC2 — Canchariane v2

Esta guía detalla los pasos para desplegar Canchariane v2 en una instancia **AWS EC2** (Ubuntu 22.04 / 24.04 LTS o Debian 12) utilizando Docker Compose con los puertos configurados:
- **Frontend (Angular Standalone + NGINX)**: Puerto `8005`
- **Backend (FastAPI + SQLAlchemy Async)**: Puerto `8004`
- **Base de Datos (PostgreSQL 16 + GiST)**: Puerto `5432` (interno / opcional externo)

---

## 1. Configurar Security Group en AWS EC2

En la consola de AWS EC2, asegúrate de que el **Security Group** asignado a la instancia tenga las siguientes reglas de entrada (**Inbound Rules**):

| Tipo | Protocolo | Rango de Puertos | Origen | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| **SSH** | TCP | `22` | `Tu IP` o `0.0.0.0/0` | Acceso a terminal SSH |
| **Custom TCP** | TCP | `8005` | `0.0.0.0/0` | Acceso Web al **Frontend** |
| **Custom TCP** | TCP | `8004` | `0.0.0.0/0` | Acceso API REST / Swagger al **Backend** |

---

## 2. Instalar Docker y Docker Compose en la Instancia EC2

Conéctate a tu instancia vía SSH:
```bash
ssh -i tu-clave.pem ubuntu@<IP_PUBLICA_EC2>
```

Si aún no tienes Docker instalado en tu instancia Ubuntu, ejecuta:
```bash
# 1. Actualizar paquetes del sistema
sudo apt update && sudo apt upgrade -y

# 2. Instalar Docker oficial
curl -fsSL https://get.docker.com | sh

# 3. Dar permisos a tu usuario ubuntu para usar docker sin sudo
sudo usermod -aG docker $USER

# 4. Instalar plugin de Docker Compose
sudo apt install -y docker-compose-plugin

# 5. Aplicar cambios de grupo (o reiniciar sesión SSH)
newgrp docker
```

Verifica la instalación:
```bash
docker --version
docker compose version
```

---

## 3. Clonar el Repositorio y Desplegar

```bash
# 1. Clonar el proyecto
git clone <URL_DE_TU_REPOSITORIO_GIT> canchariane
cd canchariane

# 2. Construir las imágenes Docker de producción (multi-stage optimizadas)
docker compose build

# 3. Iniciar todos los contenedores en segundo plano
docker compose up -d
```

### ¿Qué ocurre automáticamente al ejecutar `docker compose up -d`?
1. **`canchariane_postgres`**: Levanta PostgreSQL 16 y ejecuta `docker/init-db.sh`, habilitando la extensión `btree_gist` requerida para la restricción de exclusión de reservas sin solapamiento.
2. **`canchariane_backend`**: Espera a que la base de datos esté lista (healthcheck), ejecuta automáticamente `alembic upgrade head` para aplicar el esquema y siembra el club demo `club-alpha` con su plano SVG interactivo, iniciando FastAPI en el puerto **8004**.
3. **`canchariane_frontend`**: Sirve la aplicación compilada de Angular a través de NGINX en el puerto **8005**, configurando el proxy inverso de `/api/` hacia el backend en su red privada interna.

---

## 4. Verificar el Despliegue en Vivo

Abre en tu navegador:

- **Frontend (Wizard Público de Reserva)**:
  ```text
  http://<IP_PUBLICA_EC2>:8005/c/club-alpha
  ```
- **Consulta y Cancelación de Reservas**:
  ```text
  http://<IP_PUBLICA_EC2>:8005/lookup
  ```
- **Portal de Acceso Administrativo**:
  ```text
  http://<IP_PUBLICA_EC2>:8005/auth/login
  ```
- **Swagger / OpenAPI del Backend**:
  ```text
  http://<IP_PUBLICA_EC2>:8004/docs
  ```
- **Health Check del Backend y Base de Datos**:
  ```text
  http://<IP_PUBLICA_EC2>:8004/health/ready
  ```

---

## 5. Comandos Útiles de Operación en el Servidor

### Ver logs en tiempo real:
```bash
docker compose logs -f
# O filtrar por servicio:
docker compose logs -f backend
docker compose logs -f frontend
```

### Comprobar el estado de los contenedores:
```bash
docker compose ps
```

### Reiniciar el sistema:
```bash
docker compose restart
```

### Actualizar a una nueva versión tras hacer cambios en Git:
```bash
git pull
docker compose build
docker compose up -d
```

### Ejecutar el benchmark de 50.000 reservas en el servidor:
```bash
docker compose exec backend python scripts/seed_benchmark.py
```
