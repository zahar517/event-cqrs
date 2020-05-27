#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE TABLE event (
        event_id varchar(40) PRIMARY KEY,
        event_type varchar(40) NOT NULL,
        entity_type varchar(40) NOT NULL,
        entity_id varchar(40) NOT NULL,
        event_payload jsonb NOT NULL
    );
EOSQL
