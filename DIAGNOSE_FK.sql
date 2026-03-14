-- Step 1: Verify exactly what the FK references and current column type
SELECT 
    c.column_name,
    c.data_type,
    tc.constraint_name,
    ccu.table_name AS fk_table,
    ccu.column_name AS fk_column
FROM information_schema.columns c
LEFT JOIN information_schema.key_column_usage kcu 
    ON kcu.table_name = 'announcements' AND kcu.column_name = c.column_name
LEFT JOIN information_schema.table_constraints tc 
    ON tc.constraint_name = kcu.constraint_name AND tc.constraint_type = 'FOREIGN KEY'
LEFT JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE c.table_name = 'announcements' AND c.column_name = 'institution_id';
