FROM python:3.11-slim
WORKDIR /app
ENV PYTHONPATH=/app

COPY pyproject.toml /app/pyproject.toml
RUN pip install --no-cache-dir -U pip \
 && pip install --no-cache-dir ".[dev]"

COPY app /app/app
COPY tests /app/tests

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]