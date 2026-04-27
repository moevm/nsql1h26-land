FROM mongo:7

COPY dump /dump
COPY mongo-init/restore.sh /docker-entrypoint-initdb.d/restore.sh
COPY db/mongod.conf /etc/mongod.conf
RUN chmod +x /docker-entrypoint-initdb.d/restore.sh
