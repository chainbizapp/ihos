-- ihos PostgreSQL initialization
-- Creates the jasperreports database alongside ihos_dev

CREATE DATABASE jasperreports OWNER ihos;

-- Enable pgcrypto for gen_random_uuid()
\c ihos_dev
CREATE EXTENSION IF NOT EXISTS pgcrypto;
