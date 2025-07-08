"use server";

import { CountryCode } from "plaid";
import { plaidClient } from "../plaid";
import { parseStringify } from "../utils";
import {
  createTransaction,
  getTransactionsByBankId,
} from "./transaction.actions";
import { getBanks, getBank } from "./user.actions";

// Get multiple bank accounts
export const getAccounts = async ({ userId }: getAccountsProps) => {
  try {
    const banks = await getBanks({ userId });
    if (!banks || banks.length === 0) {
      return parseStringify({
        data: [],
        totalBanks: 0,
        totalCurrentBalance: 0,
      });
    }

    const accounts = await Promise.all(
      banks.map(async (bank: Bank) => {
        try {
          const accountsResponse = await plaidClient.accountsGet({
            access_token: bank.accessToken,
          });

          const accountData = accountsResponse.data.accounts[0];
          if (!accountData) {
            console.error("No account data found for bank:", bank.$id);
            return null;
          }

          const institution = await getInstitution({
            institutionId: accountsResponse.data.item.institution_id!,
          });

          return {
            id: accountData.account_id,
            availableBalance: accountData.balances.available || 0,
            currentBalance: accountData.balances.current || 0,
            institutionId: institution.institution_id,
            name: accountData.name,
            officialName: accountData.official_name || accountData.name,
            mask: accountData.mask || "0000",
            type: accountData.type as string,
            subtype: (accountData.subtype || "checking") as string,
            appwriteItemId: bank.$id,
            shareableId: bank.shareableId,
          };
        } catch (error) {
          console.error(`Error processing bank ${bank.$id}:`, {
            message: error instanceof Error ? error.message : String(error),
            bankId: bank.$id,
          });
          return null;
        }
      })
    );

    const validAccounts = accounts.filter((acc) => acc !== null);
    const totalBanks = validAccounts.length;
    const totalCurrentBalance = validAccounts.reduce(
      (sum, acc) => sum + (acc?.currentBalance || 0),
      0
    );

    return parseStringify({
      data: validAccounts,
      totalBanks,
      totalCurrentBalance,
    });
  } catch (error) {
    console.error("Error in getAccounts:", error);
    return parseStringify({ data: [], totalBanks: 0, totalCurrentBalance: 0 });
  }
};

// Get one bank account
export const getAccount = async ({ appwriteItemId }: getAccountProps) => {
  let accessToken: string | undefined;
  let errorCode: string | null = null;
  let account: any = null;
  let allTransactions: any[] = [];

  try {
    const bank = await getBank({ documentId: appwriteItemId });
    if (!bank) throw new Error(`Bank not found: ${appwriteItemId}`);
    accessToken = bank.accessToken;
    if (!accessToken) throw new Error("No access token found for bank");

    // 1. Fetch account details
    const { data: accountsData } = await plaidClient.accountsGet({
      access_token: accessToken,
    });
    const accountData = accountsData.accounts?.[0];
    if (!accountData) throw new Error("No account data returned from Plaid");

    const institution = await getInstitution({
      institutionId: accountsData.item.institution_id!,
    });
    account = {
      id: accountData.account_id,
      availableBalance: accountData.balances.available!,
      currentBalance: accountData.balances.current!,
      institutionId: institution.institution_id,
      name: accountData.name,
      officialName: accountData.official_name,
      mask: accountData.mask!,
      type: accountData.type,
      subtype: accountData.subtype!,
      appwriteItemId: bank.$id,
    };

    // 2. Fetch Plaid transactions, capturing consent error
    let plaidTransactions: any[] = [];
    try {
      plaidTransactions = await getTransactions({ accessToken });
    } catch (err: any) {
      const code = err?.response?.data?.error_code;
      if (code) {
        console.warn("Plaid consent error code:", code);
        errorCode = code;
      } else {
        console.error("Unexpected Plaid error:", err);
      }
      plaidTransactions = [];
    }

    // 3. Store new transactions with rich metadata
    const stored = await Promise.all(
      plaidTransactions.map(async (t) =>
        createTransaction({
          name: t.name,
          amount: Math.abs(t.amount),
          senderBankId: t.amount < 0 ? bank.$id : bank.$id,
          receiverBankId: t.amount >= 0 ? bank.$id : bank.$id,
          userId: bank.userId,
          type: t.amount < 0 ? "debit" : "credit",
          category: await mapPlaidCategory(
            t.personal_finance_category?.primary
          ),
          channel: t.paymentChannel || "other",
          date: t.date,
          senderId: bank.userId,
          receiverId: bank.userId,
          merchant: t.merchant_name || t.name,
          logoUrl: t.image,
          website: t.website,
          plaidTransactionId: t.id,
        }).catch((e) => {
          console.error("Error storing transaction:", e);
          return null;
        })
      )
    );

    // 4. Fetch internal transfers with proper error handling
    let transferTxns: any[] = [];
    try {
      const transferData = await getTransactionsByBankId({ bankId: bank.$id });
      transferTxns =
        transferData?.documents?.map((t: any) => ({
          id: t.$id,
          name: t.name || "Transfer",
          amount: t.amount!,
          date: t.date || t.$createdAt,
          paymentChannel: t.channel || "transfer",
          category: t.category || "Transfer",
          type: t.type || (t.senderBankId === bank.$id ? "debit" : "credit"),
        })) || [];
    } catch (error) {
      console.error("Error fetching transfer transactions:", error);
      transferTxns = [];
    }

    // 5. Combine, sort
    allTransactions = [...stored.filter(Boolean), ...transferTxns].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return parseStringify({
      data: account,
      transactions: allTransactions,
      accessToken,
      errorCode,
      status: "complete",
    });
  } catch (error: any) {
    console.error("Error in getAccount:", {
      appwriteItemId,
      message: error.message,
    });
    return parseStringify({
      data: account,
      transactions: [],
      accessToken,
      errorCode,
      status: "error",
    });
  }
};

// Get bank info
export const getInstitution = async ({
  institutionId,
}: getInstitutionProps) => {
  try {
    const institutionResponse = await plaidClient.institutionsGetById({
      institution_id: institutionId,
      country_codes: ["US"] as CountryCode[],
    });

    return parseStringify(institutionResponse.data.institution);
  } catch (error) {
    console.error("Error in getInstitution:", error);
    return parseStringify({
      institution_id: institutionId,
      name: "Unknown Institution",
    });
  }
};

// Get transactions
export const getTransactions = async ({
  accessToken,
}: getTransactionsProps) => {
  let hasMore = true;
  let transactions: any = [];

  try {
    while (hasMore) {
      const response = await plaidClient.transactionsSync({
        access_token: accessToken,
      });
      const data = response.data;

      transactions = response.data.added.map((transaction) => ({
        id: transaction.transaction_id,
        name: transaction.name,
        paymentChannel: transaction.payment_channel,
        type: transaction.payment_channel,
        accountId: transaction.account_id,
        amount: transaction.amount,
        pending: transaction.pending,
        personal_finance_category: transaction.personal_finance_category,
        merchant_name: transaction.merchant_name,
        image: transaction.logo_url,
        website: transaction.website,
        date: transaction.date,
      }));

      hasMore = data.has_more;
    }

    return parseStringify(transactions);
  } catch (error) {
    console.error("An error occurred while getting transactions:", error);
    throw error;
  }
};

// Helper: map Plaid's PFC to app categories
export async function mapPlaidCategory(pfc?: string): Promise<string> {
  const map: Record<string, string> = {
    FOOD_AND_DRINK: "Food and Drink",
    TRAVEL: "Travel",
    TRANSPORTATION: "Travel",
    GENERAL_MERCHANDISE: "Shopping",
    LOAN_PAYMENTS: "Payment",
    PAYMENTS: "Payment",
    OUTGOING_TRANSFERS: "Transfer",
    BANK_FEES: "Bank Fees",
    INCOME: "Success", // e.g. interest, wages
    // you can add more if you encounter new `primary` codes
  };
  return pfc && map[pfc] ? map[pfc] : "Uncategorized";
}
