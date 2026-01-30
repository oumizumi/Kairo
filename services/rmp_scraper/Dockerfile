FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY src ./src
COPY README.md ./README.md

CMD ["python", "src/main.py"]
