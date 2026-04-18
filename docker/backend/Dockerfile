FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

EXPOSE 8080

# Production WSGI-сервер gunicorn
# -w 4          — 4 воркера (рекомендуется 2 * CPU + 1)
# --threads 2   — 2 потока на воркер (для psycopg2 достаточно)
# -t 120        — таймаут 120 сек на запрос
# --access-logfile - — логи в stdout (видно в docker logs)
CMD ["gunicorn", \
     "-w", "4", \
     "--threads", "2", \
     "-b", "0.0.0.0:8080", \
     "-t", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "app:app"]