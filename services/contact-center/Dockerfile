FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 libsndfile1 libportaudio2 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
RUN useradd --uid 10001 --create-home service && mkdir -p /data && chown -R service:service /app /data
USER service
ENV DATABASE_PATH=/data/contact-center.sqlite
EXPOSE 8090
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8090","--no-access-log"]
