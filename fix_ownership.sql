DO $$ 
DECLARE 
    r RECORD; 
BEGIN 
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP 
        EXECUTE 'ALTER TABLE ' || quote_ident(r.tablename) || ' OWNER TO nclinic'; 
    END LOOP; 
END $$;