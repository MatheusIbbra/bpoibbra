import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { encode as base64Encode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ImportRequest {
  batchId: string;
  organizationId: string;
  accountId: string;
  fileContent?: string;
  filePath?: string;
  fileType: "ofx" | "csv" | "pdf";
}

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  raw_description: string;
  hash: string;
}

// Generate SHA-256 hash for duplicate detection
async function generateHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Parse OFX file content
function parseOFX(content: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  
  const stmtTrnPattern = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;
  
  while ((match = stmtTrnPattern.exec(content)) !== null) {
    const trnContent = match[1];
    
    // Parse DTPOSTED - format can be YYYYMMDD or YYYYMMDDHHMMSS or with timezone
    const dateMatch = /<DTPOSTED>(\d{8,14})(\[-?\d+:\w+\])?/i.exec(trnContent);
    let date = new Date().toISOString().split("T")[0];
    if (dateMatch) {
      const d = dateMatch[1];
      // Extract just the date part (YYYYMMDD) - ignore time and timezone to prevent day shift
      const year = d.slice(0, 4);
      const month = d.slice(4, 6);
      const day = d.slice(6, 8);
      // Format as YYYY-MM-DD (ISO date format)
      date = `${year}-${month}-${day}`;
      console.log(`[OFX] Parsed date: ${d} -> ${date}`);
    }
    
    const amountMatch = /<TRNAMT>([-\d.,]+)/i.exec(trnContent);
    let amount = 0;
    if (amountMatch) {
      // Handle both dot and comma as decimal separator
      const amountStr = amountMatch[1].replace(',', '.');
      amount = parseFloat(amountStr);
    }
    
    const memoMatch = /<MEMO>([^<]+)/i.exec(trnContent);
    const nameMatch = /<NAME>([^<]+)/i.exec(trnContent);
    const description = memoMatch?.[1]?.trim() || nameMatch?.[1]?.trim() || "Sem descrição";
    
    // Detect credit card invoice payments
    const isInvoicePayment = /fatura|invoice|pagamento.*cart[aã]o|cart[aã]o.*cr[eé]dito/i.test(description);
    
    transactions.push({
      date,
      description: description.substring(0, 255),
      amount: Math.abs(amount),
      type: amount >= 0 ? "income" : "expense",
      raw_description: description,
      hash: "",
    });
    
    // Log if invoice payment detected
    if (isInvoicePayment) {
      console.log(`[OFX] Invoice payment detected: ${description}`);
    }
  }
  
  return transactions;
}

// Parse CSV file content
function parseCSV(content: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const lines = content.split("\n").filter((line) => line.trim());
  
  if (lines.length < 2) return transactions;
  
  const header = lines[0].toLowerCase();
  const separator = header.includes(";") ? ";" : ",";
  const columns = header.split(separator).map((col) => col.trim().replace(/"/g, ""));
  
  const dateIdx = columns.findIndex((c) => 
    c.includes("data") || c.includes("date") || c === "dt"
  );
  const descIdx = columns.findIndex((c) => 
    c.includes("descri") || c.includes("memo") || c.includes("historico")
  );
  const valueIdx = columns.findIndex((c) => 
    c.includes("valor") || c.includes("amount") || c.includes("value")
  );
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(separator).map((v) => v.trim().replace(/"/g, ""));
    
    let date = new Date().toISOString().split("T")[0];
    if (dateIdx >= 0 && values[dateIdx]) {
      const dateStr = values[dateIdx];
      if (dateStr.includes("/")) {
        const parts = dateStr.split("/");
        if (parts[0].length === 4) {
          date = `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
        } else {
          date = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        }
      } else if (dateStr.includes("-")) {
        date = dateStr;
      }
    }
    
    const description = descIdx >= 0 ? values[descIdx] || "Sem descrição" : "Sem descrição";
    
    let amount = 0;
    if (valueIdx >= 0 && values[valueIdx]) {
      const amountStr = values[valueIdx]
        .replace(/[^\d,.-]/g, "")
        .replace(",", ".");
      amount = parseFloat(amountStr) || 0;
    }
    
    if (amount === 0) continue;
    
    transactions.push({
      date,
      description: description.substring(0, 255),
      amount: Math.abs(amount),
      type: amount >= 0 ? "income" : "expense",
      raw_description: description,
      hash: "",
    });
  }
  
  return transactions;
}

// Parse PDF using AI (Lovable AI Gateway) - OPTIMIZED for CPU time
async function parsePDF(pdfBytes: Uint8Array): Promise<ParsedTransaction[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured for PDF parsing");
    throw new Error("Configuração de IA não encontrada para processar PDF");
  }

  // Limit PDF size to avoid CPU timeout (max 500KB for vision mode)
  const MAX_PDF_SIZE = 500 * 1024; // 500KB
  if (pdfBytes.length > MAX_PDF_SIZE) {
    throw new Error(
      `PDF muito grande (${(pdfBytes.length / 1024).toFixed(0)}KB). ` +
      `Tamanho máximo permitido: 500KB. Use OFX ou CSV para arquivos maiores.`
    );
  }

  // Always use vision mode for PDFs - text extraction is unreliable
  console.log("Sending PDF for AI vision analysis");
  const contentForAI = base64Encode(pdfBytes);
  console.log("Base64 content length:", contentForAI.length);

  const systemPrompt = `Você é um especialista em extrair transações financeiras de extratos bancários brasileiros.
Analise o extrato e extraia as transações encontradas.

Para cada transação, identifique:
- data: formato YYYY-MM-DD
- descricao: descrição da transação
- valor: número (positivo para créditos, negativo para débitos)

REGRAS:
1. Extraia as transações visíveis
2. Retorne APENAS um array JSON válido
3. Se não encontrar transações, retorne []
4. Formato: [{"data": "2024-01-15", "descricao": "PIX", "valor": 150.00}]
5. Débitos = valores NEGATIVOS, Créditos = valores POSITIVOS`;

  const userPrompt = `Analise este extrato bancário e extraia as transações financeiras. Retorne APENAS o array JSON.`;

  try {
    console.log("Calling AI for PDF parsing (vision mode)...");
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: [
              { type: "text", text: userPrompt },
              { 
                type: "image_url", 
                image_url: { 
                  url: `data:application/pdf;base64,${contentForAI}` 
                } 
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 8000, // Reduced for faster response
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        throw new Error("Limite de requisições excedido. Tente novamente em alguns minutos.");
      }
      if (response.status === 402) {
        throw new Error("Créditos de IA esgotados. Entre em contato com o suporte.");
      }
      throw new Error("Erro ao processar PDF com IA");
    }

    const data = await response.json();
    const aiContent = data.choices?.[0]?.message?.content;
    
    if (!aiContent) {
      console.error("No content in AI response");
      throw new Error("Resposta vazia da IA ao processar PDF");
    }

    console.log("AI response received, length:", aiContent.length);

    // Try to extract JSON array from the response
    let jsonStr = aiContent.trim();
    
    // Remove markdown code blocks if present
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.replace(/^```json\n?/, "").replace(/\n?```$/, "");
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```\n?/, "").replace(/\n?```$/, "");
    }
    
    // Find JSON array in the response
    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("No JSON array found in AI response");
      return [];
    }

    const extractedTransactions = JSON.parse(jsonMatch[0]);
    
    if (!Array.isArray(extractedTransactions)) {
      console.error("AI response is not an array");
      return [];
    }

    console.log(`AI extracted ${extractedTransactions.length} transactions`);

    // Convert to ParsedTransaction format
    const transactions: ParsedTransaction[] = [];
    
    for (const tx of extractedTransactions) {
      const date = tx.data || tx.date || new Date().toISOString().split("T")[0];
      const description = tx.descricao || tx.description || "Sem descrição";
      const amount = parseFloat(tx.valor || tx.value || tx.amount || 0);
      
      if (amount === 0) continue;
      
      transactions.push({
        date,
        description: description.substring(0, 255),
        amount: Math.abs(amount),
        type: amount >= 0 ? "income" : "expense",
        raw_description: description,
        hash: "",
      });
    }

    return transactions;
  } catch (error) {
    console.error("Error parsing PDF with AI:", error);
    throw error;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Verify user token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ImportRequest = await req.json();
    const { batchId, organizationId, accountId, fileContent, filePath, fileType } = body;

    console.log(`Processing import batch ${batchId} for org ${organizationId}, type: ${fileType}`);

    // Update batch status to processing
    await supabase
      .from("import_batches")
      .update({ status: "processing" })
      .eq("id", batchId);

    // Parse file content based on type
    let parsedTransactions: ParsedTransaction[] = [];
    
    try {
      if (fileType === "ofx") {
        if (!fileContent) throw new Error("Conteúdo do arquivo OFX não fornecido");
        parsedTransactions = parseOFX(fileContent);
      } else if (fileType === "csv") {
        if (!fileContent) throw new Error("Conteúdo do arquivo CSV não fornecido");
        parsedTransactions = parseCSV(fileContent);
      } else if (fileType === "pdf") {
        // For PDFs, download from storage to get binary content
        let pdfBytes: Uint8Array;
        
        if (filePath) {
          console.log("Downloading PDF from storage:", filePath);
          const { data: fileData, error: downloadError } = await supabase.storage
            .from("extratos")
            .download(filePath);
          
          if (downloadError || !fileData) {
            console.error("Error downloading PDF:", downloadError);
            throw new Error("Erro ao baixar PDF do storage");
          }
          
          pdfBytes = new Uint8Array(await fileData.arrayBuffer());
          console.log("Downloaded PDF, size:", pdfBytes.length, "bytes");
        } else if (fileContent) {
          // Fallback: try to use fileContent as bytes
          const encoder = new TextEncoder();
          pdfBytes = encoder.encode(fileContent);
          console.log("Using fileContent as fallback, size:", pdfBytes.length);
        } else {
          throw new Error("Caminho ou conteúdo do PDF não fornecido");
        }
        
        parsedTransactions = await parsePDF(pdfBytes);
      }
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : "Erro ao processar arquivo";
      console.error("Parse error:", errorMessage);
      
      await supabase
        .from("import_batches")
        .update({ 
          status: "failed",
          error_message: errorMessage
        })
        .eq("id", batchId);
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Parsed ${parsedTransactions.length} transactions`);

    if (parsedTransactions.length === 0) {
      await supabase
        .from("import_batches")
        .update({ 
          status: "failed",
          error_message: "Nenhuma transação encontrada no arquivo"
        })
        .eq("id", batchId);
      
      return new Response(
        JSON.stringify({ error: "No transactions found in file" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate hashes for duplicate detection
    for (const tx of parsedTransactions) {
      const hashInput = `${accountId}|${tx.date}|${tx.amount}|${tx.raw_description}`;
      tx.hash = await generateHash(hashInput);
    }

    // Check for existing duplicates
    const hashes = parsedTransactions.map((t) => t.hash);
    const { data: existingTx } = await supabase
      .from("transactions")
      .select("transaction_hash")
      .eq("account_id", accountId)
      .in("transaction_hash", hashes);

    const existingHashes = new Set(existingTx?.map((t) => t.transaction_hash) || []);

    // Separate new and duplicate transactions
    const newTransactions = parsedTransactions.filter((t) => !existingHashes.has(t.hash));
    const duplicateCount = parsedTransactions.length - newTransactions.length;

    console.log(`Found ${duplicateCount} duplicates, ${newTransactions.length} new transactions`);

    // Extract period
    const dates = parsedTransactions.map((t) => new Date(t.date)).filter((d) => !isNaN(d.getTime()));
    const periodStart = dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
    const periodEnd = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;

    // Insert new transactions in batch for better performance
    let importedCount = 0;
    let errorCount = 0;

    if (newTransactions.length > 0) {
      const transactionsToInsert = newTransactions.map(tx => ({
        organization_id: organizationId,
        account_id: accountId,
        user_id: user.id,
        import_batch_id: batchId,
        date: tx.date,
        description: tx.description,
        raw_description: tx.raw_description,
        amount: tx.amount,
        type: tx.type,
        transaction_hash: tx.hash,
        status: "completed",
        validation_status: "pending_validation",
      }));

      const { data: insertedData, error: insertError } = await supabase
        .from("transactions")
        .insert(transactionsToInsert)
        .select("id");

      if (insertError) {
        console.error(`Batch insert error: ${insertError.message}`);
        errorCount = newTransactions.length;
      } else {
        importedCount = insertedData?.length || 0;
        errorCount = newTransactions.length - importedCount;
      }
    }

    // Update batch with results
    await supabase
      .from("import_batches")
      .update({
        status: "awaiting_validation",
        total_transactions: parsedTransactions.length,
        imported_count: importedCount,
        duplicate_count: duplicateCount,
        error_count: errorCount,
        period_start: periodStart?.toISOString().split("T")[0],
        period_end: periodEnd?.toISOString().split("T")[0],
      })
      .eq("id", batchId);

    console.log(`Import completed: ${importedCount} imported, ${duplicateCount} duplicates, ${errorCount} errors`);

    // Auto-classify ALL imported transactions (mandatory - no manual step needed)
    let classifiedCount = 0;
    if (importedCount > 0) {
      try {
        console.log("Auto-classifying all imported transactions...");
        
        const { data: batchTransactions } = await supabase
          .from("transactions")
          .select("id")
          .eq("import_batch_id", batchId)
          .limit(500);

        if (batchTransactions && batchTransactions.length > 0) {
          const transactionIds = batchTransactions.map(t => t.id);
          
          const classifyResponse = await fetch(`${supabaseUrl}/functions/v1/classify-transactions`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${supabaseServiceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              transactionIds,
              organizationId,
            }),
          });

          if (classifyResponse.ok) {
            const classifyResult = await classifyResponse.json();
            classifiedCount = classifyResult?.suggestionsCreated || 0;
            console.log(`Auto-classified ${classifiedCount} transactions`);
          } else {
            console.error("Classification response error:", classifyResponse.status);
          }
        }
      } catch (classifyError) {
        console.error("Error in auto-classification:", classifyError);
        // Don't fail the import if classification fails
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: parsedTransactions.length,
        imported: importedCount,
        duplicates: duplicateCount,
        errors: errorCount,
        classified: classifiedCount,
        periodStart: periodStart?.toISOString().split("T")[0],
        periodEnd: periodEnd?.toISOString().split("T")[0],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing import:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
