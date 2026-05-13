FROM mongo:7

COPY dump /dump
COPY mongo-init/restore.sh /docker-entrypoint-initdb.d/restore.sh
RUN chmod +x /docker-entrypoint-initdb.d/restore.sh
