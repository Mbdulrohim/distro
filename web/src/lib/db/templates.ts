import "server-only";
import { db } from "./client";

export interface TemplateRecipient {
  address: string;
  /** Base units, as a string (jsonb has no bigint). */
  amount: string;
}

export interface TemplateSummary {
  id: string;
  name: string;
  tokenSymbol: string;
  tokenDecimals: number;
  recipientCount: number;
  createdAt: string;
}

export interface TemplateDetail extends TemplateSummary {
  tokenAddress: string;
  recipients: TemplateRecipient[];
}

interface TemplateRow {
  id: string;
  name: string;
  token_address: string;
  token_symbol: string;
  token_decimals: number;
  recipients: TemplateRecipient[];
  recipient_count: number;
  created_at: string;
}

const toSummary = (row: TemplateRow): TemplateSummary => ({
  id: row.id,
  name: row.name,
  tokenSymbol: row.token_symbol,
  tokenDecimals: row.token_decimals,
  recipientCount: row.recipient_count,
  createdAt: row.created_at,
});

export async function listTemplates(userId: string): Promise<TemplateSummary[]> {
  const rows = (await db()`
    SELECT id, name, token_address, token_symbol, token_decimals,
           recipients, recipient_count, created_at
    FROM templates
    WHERE user_id = ${userId} AND deleted_at IS NULL
    ORDER BY created_at DESC
  `) as TemplateRow[];
  return rows.map(toSummary);
}

export async function getTemplate(id: string, userId: string): Promise<TemplateDetail | null> {
  const rows = (await db()`
    SELECT id, name, token_address, token_symbol, token_decimals,
           recipients, recipient_count, created_at
    FROM templates
    WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL
    LIMIT 1
  `) as TemplateRow[];
  const row = rows[0];
  return row
    ? { ...toSummary(row), tokenAddress: row.token_address, recipients: row.recipients }
    : null;
}

export async function createTemplate(
  userId: string,
  input: {
    name: string;
    tokenAddress: string;
    tokenSymbol: string;
    tokenDecimals: number;
    recipients: TemplateRecipient[];
  },
): Promise<string> {
  const rows = (await db()`
    INSERT INTO templates (
      user_id, name, token_address, token_symbol, token_decimals,
      recipients, recipient_count
    ) VALUES (
      ${userId}, ${input.name}, ${input.tokenAddress}, ${input.tokenSymbol},
      ${input.tokenDecimals}, ${JSON.stringify(input.recipients)}::jsonb,
      ${input.recipients.length}
    )
    RETURNING id
  `) as { id: string }[];
  return rows[0].id;
}

export async function deleteTemplate(id: string, userId: string): Promise<boolean> {
  const rows = (await db()`
    UPDATE templates
    SET deleted_at = now(), updated_at = now()
    WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL
    RETURNING id
  `) as { id: string }[];
  return rows.length > 0;
}
