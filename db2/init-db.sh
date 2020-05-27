#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE TABLE item (
        id varchar(40) PRIMARY KEY,
        plan integer NOT NULL,
        fact integer NOT NULL,
        name varchar(40) NOT NULL,
        comment varchar(40) NOT NULL,
        creation_time timestamp with time zone DEFAULT now(),
        update_time timestamp with time zone DEFAULT now()
    );
    CREATE TABLE correction (
        id varchar(40) PRIMARY KEY,
        changes jsonb NOT NULL,
        status varchar(40) NOT NULL,
        creation_time timestamp with time zone DEFAULT now(),
        update_time timestamp with time zone DEFAULT now()
    );
EOSQL
