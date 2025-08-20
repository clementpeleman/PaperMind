// src/lib/pg-meta.ts

/**
 * Bouwt een SQL-query om alle tabellen op te lijsten.
 * @param schemas Optioneel: lijst van schema's om te filteren.
 * @returns SQL-string
 */
export const listTablesSql = (schemas?: string[]): string => {
  let schemaFilter = '';
  if (schemas && schemas.length > 0) {
    const formatted = schemas.map(s => `'${s}'`).join(', ');
    schemaFilter = `WHERE table_schema IN (${formatted})`;
  }

  return `
    SELECT
      table_schema,
      table_name
    FROM information_schema.tables
    ${schemaFilter}
    ORDER BY table_schema, table_name;
  `;
};
