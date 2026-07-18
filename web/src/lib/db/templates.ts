import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Templates — a saved distribution shape a user can start a new distribution
 * from. Scoped to `userId` on the server, same pattern as lib/db/distribution.ts.
 */

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

export async function listTemplates(userId: string): Promise<TemplateSummary[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("templates")
    .select("id, name, token_symbol, token_decimals, recipient_count, created_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load templates: ${error.message}`);

  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    tokenSymbol: t.token_symbol,
    tokenDecimals: t.token_decimals,
    recipientCount: t.recipient_count,
    createdAt: t.created_at,
  }));
}

/** Returns null when the template doesn't exist *or* isn't this user's. */
export async function getTemplate(id: string, userId: string): Promise<TemplateDetail | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("templates")
    .select(
      "id, name, token_address, token_symbol, token_decimals, recipients, recipient_count, created_at",
    )
    .eq("id", id)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    tokenAddress: data.token_address,
    tokenSymbol: data.token_symbol,
    tokenDecimals: data.token_decimals,
    recipients: data.recipients as TemplateRecipient[],
    recipientCount: data.recipient_count,
    createdAt: data.created_at,
  };
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
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("templates")
    .insert({
      user_id: userId,
      name: input.name,
      token_address: input.tokenAddress,
      token_symbol: input.tokenSymbol,
      token_decimals: input.tokenDecimals,
      recipients: input.recipients,
      recipient_count: input.recipients.length,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(`Failed to create template: ${error?.message}`);
  return data.id;
}

/** Returns false when the template doesn't exist or isn't this user's. */
export async function deleteTemplate(id: string, userId: string): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("templates")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Failed to delete template: ${error.message}`);
  return data !== null;
}
